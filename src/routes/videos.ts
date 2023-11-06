import express from 'express';
import multer from 'multer';
import AWS from 'aws-sdk';
import cassandra from 'cassandra-driver';

const router = express.Router();

const s3Client = new AWS.S3({
    accessKeyId: 'ROOTNAME',
    secretAccessKey: 'CHANGEME123',
    endpoint: 'http://localhost:9000',
    s3ForcePathStyle: true,
    signatureVersion: 'v4'
});

const cassandraClient = new cassandra.Client({ 
    contactPoints: ['localhost:9042'], 
    localDataCenter: 'datacenter1',
    keyspace: 'videokeyspace' 
});

const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', upload.single('video'), async (req: express.Request, res: express.Response) => {
    try {
        // Save to MinIO
        const videoKey = `${Date.now()}-${req.file!.originalname}`;
        await s3Client.putObject({
            Bucket: 'videos',
            Key: videoKey,
            Body: req.file!.buffer,
            ContentType: req.file!.mimetype
        }).promise();

        // Save metadata to Cassandra
        const videoId = cassandra.types.Uuid.random();
        await cassandraClient.execute('INSERT INTO videos (video_id, title, description, object_storage_key, created_at) VALUES (?, ?, ?, ?, ?)', [
            videoId,
            req.body.title,
            req.body.description,
            videoKey,
            new Date()
        ]);

        res.status(200).send({ success: true, message: 'Video uploaded successfully!', videoId });
    } catch (error: any) {
        res.status(500).send({ success: false, message: error.message });
    }
});

router.get('/search', async (req: express.Request, res: express.Response) => {
    try {
        const title = req.query.title as string;
        if (!title) {
            return res.status(400).send({ success: false, message: 'Title is required for searching.' });
        }

        const result = await cassandraClient.execute('SELECT * FROM videos WHERE title = ?', [title]);
        const videos = result.rows.map(video => {
            // Add a temporary URL to fetch the video from MinIO (if needed)
            video.url = s3Client.getSignedUrl('getObject', { Bucket: 'videos', Key: video.object_storage_key, Expires: 3600 });
            return video;
        });

        res.send(videos);
    } catch (error: any) {
        res.status(500).send({ success: false, message: error.message });
    }
});

// Add this new route to the backend

router.get('/allVideos', async (req: express.Request, res: express.Response) => {
    try {
        const result = await cassandraClient.execute('SELECT * FROM videos');
        const videos = result.rows.map((video) => {
            return {
                videoId: video.video_id,
                title: video.title,
                description: video.description,
                url: s3Client.getSignedUrl('getObject', { Bucket: 'videos', Key: video.object_storage_key, Expires: 3600 })
            };
        });

        res.status(200).send(videos);
    } catch (error: any) {
        res.status(500).send({ success: false, message: error.message });
    }
});



export default router;
