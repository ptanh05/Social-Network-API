export function ok(res, data) {
    res.json(data);
}
export function created(res, data) {
    res.status(201).json(data);
}
export function noContent(res) {
    res.sendStatus(204);
}
export function err(res, status, msg) {
    res.status(status).json({ detail: msg });
}
export function rateLimitResponse(res, retryAfter) {
    res.status(429)
        .set('Retry-After', String(retryAfter))
        .json({ detail: 'Too many requests. Please try again later.' });
}
