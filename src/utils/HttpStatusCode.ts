/** HTTP status codes used by this API (centralized for consistency). */
export class HttpStatusCode {
  static readonly OK = 200;
  static readonly CREATED = 201;
  static readonly NO_CONTENT = 204;
  static readonly MOVED_PERMANENTLY = 301;
  static readonly FOUND = 302;
  static readonly BAD_REQUEST = 400;
  static readonly UNAUTHORIZED = 401;
  static readonly NOT_FOUND = 404;
  static readonly FORBIDDEN = 403;
  static readonly CONFLICT = 409;
  static readonly GONE = 410;
  static readonly UNPROCESSABLE_ENTITY = 422;
  static readonly TOO_MANY_REQUESTS = 429;
  static readonly INTERNAL_SERVER_ERROR = 500;
  static readonly SERVICE_UNAVAILABLE = 503;
}
