import request from 'supertest';
import express from 'express';
import { channelRoutes } from '../src/routes/channels';
// Create a test app
const app = express();
app.use(express.json());
app.use('/v1/channels', channelRoutes);
describe('channels', () => {
    it('create -> get', async () => {
        // Create a channel
        const channelData = {
            name: 'Test Channel',
            workspaceId: 'workspace-1',
            description: 'テストチャンネル',
        };
        const createResponse = await request(app)
            .post('/v1/channels')
            .send(channelData)
            .expect(201);
        expect(createResponse.body.success).toBe(true);
        expect(createResponse.body.data.name).toBe('Test Channel');
        expect(createResponse.body.data.workspaceId).toBe('workspace-1');
        const channelId = createResponse.body.data.id;
        // Get the channel
        const getResponse = await request(app)
            .get(`/v1/channels/${channelId}`)
            .expect(200);
        expect(getResponse.body.success).toBe(true);
        expect(getResponse.body.data.name).toBe('Test Channel');
        expect(getResponse.body.data.id).toBe(channelId);
    });
    it('validates required fields', async () => {
        const invalidData = {
            name: '', // Empty name should fail
        };
        const response = await request(app)
            .post('/v1/channels')
            .send(invalidData)
            .expect(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
    it('filters channels by workspaceId', async () => {
        // Create channels in different workspaces
        await request(app)
            .post('/v1/channels')
            .send({ name: 'Channel 1', workspaceId: 'workspace-1' });
        await request(app)
            .post('/v1/channels')
            .send({ name: 'Channel 2', workspaceId: 'workspace-2' });
        // Get channels for workspace-1 only
        const response = await request(app)
            .get('/v1/channels?workspaceId=workspace-1')
            .expect(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].workspaceId).toBe('workspace-1');
    });
});
