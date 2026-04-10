import { error } from '../lib/errors.js'

export function validate(schema) {
  return async (request) => {
    try {
      const body = await request.json()
      const validated = schema.parse(body)
      request.validated = validated
    } catch (e) {
      if (e.errors) {
        return error(400, e.errors.map(err => `${err.path.join('.')}: ${err.message}`).join('; '))
      }
      return error(400, 'Invalid request body')
    }
  }
}
