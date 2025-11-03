# Scaling Guide

## Horizontal Scaling with Socket.io

Accessly supports horizontal scaling when running multiple instances behind a load balancer.

## Redis Adapter (Recommended)

When `REDIS_URL` is set, Socket.io automatically uses the Redis adapter, allowing multiple instances to share Socket.io state.

### Setup

1. **Deploy Redis**
   ```bash
   # Using Docker Compose (already configured)
   docker-compose up -d redis
   ```

   Or use managed Redis:
   - AWS ElastiCache
   - Redis Cloud
   - Upstash Redis
   - Railway Redis

2. **Configure Environment**
   ```bash
   REDIS_URL=redis://your-redis-host:6379
   ```

3. **Scale Instances**
   ```bash
   # Fly.io
   fly scale count 3

   # Render
   # Use scale slider in dashboard

   # Railway
   # Increase instance count
   ```

### How It Works

```
┌─────────────┐
│ Load Balancer│
└──────┬───────┘
       │
   ┌───┴───┐
   │       │
┌──▼──┐ ┌─▼──┐
│App 1│ │App 2│  Multiple instances
└──┬──┘ └─┬──┘
   │      │
   └──┬───┘
      │
   ┌──▼───┐
   │Redis │  Shared Socket.io state
   └──────┘
```

With Redis adapter:
- Socket.io events are published to Redis
- All instances receive events via Redis subscription
- No sticky sessions needed
- Works seamlessly across instances

## Load Balancer Configuration

### Option 1: Redis Adapter (Recommended)

**No sticky sessions needed!**

When Redis adapter is configured, Socket.io works across all instances without requiring session stickiness.

Example Nginx config:
```nginx
upstream accessly {
    least_conn;  # or round-robin, ip_hash not needed
    server app1:3000;
    server app2:3000;
    server app3:3000;
}

server {
    listen 80;
    
    location / {
        proxy_pass http://accessly;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # WebSocket support for Socket.io
    location /socket.io {
        proxy_pass http://accessly;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}
```

### Option 2: Sticky Sessions (Not Recommended)

If you cannot use Redis adapter, enable sticky sessions:

```nginx
upstream accessly {
    ip_hash;  # Sticky sessions
    server app1:3000;
    server app2:3000;
    server app3:3000;
}
```

**Limitations:**
- Users must connect to the same instance
- Less efficient load distribution
- More complex scaling

## Testing Scaling

1. **Deploy 2+ instances**
2. **Connect multiple clients**
3. **Send messages from different clients**
4. **Verify all clients receive messages** (via Redis)

## Performance Considerations

- **Redis latency**: Adds minimal overhead (~1-2ms per event)
- **Memory**: Redis adapter stores minimal state
- **Connections**: Each Socket.io connection stays on one instance
- **Events**: Broadcasted via Redis pub/sub

## Monitoring

Check Redis adapter is working:
- Verify `REDIS_URL` is set
- Check logs for "Using Redis adapter for Socket.io"
- Monitor Redis pub/sub metrics
- Test with multiple instances
