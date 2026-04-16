import { err } from '../lib/utils.js';
export function validate(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const zerr = result.error;
            const messages = zerr.issues
                .map((e) => `${e.path.join('.')}: ${e.message}`)
                .join(', ');
            return err(res, 400, messages);
        }
        req.body = result.data;
        next();
    };
}
