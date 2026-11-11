import type { ParamsDictionary } from 'express-serve-static-core'
import type { RequestHandler } from 'express'
import type { ParsedQs } from 'qs'
import type { ErrorCode, ErrorDetail } from '../lib/api-error.js'

export interface ApiSuccess<T> {
  data: T
  meta: { requestId: string }
}
export interface ApiFailure {
  error: { code: ErrorCode; message: string; details: readonly ErrorDetail[] }
  meta: { requestId: string }
}
export interface ValidatedLocals<T> extends Record<string, unknown> {
  validated: T
}
export type ValidatedHandler<T, R> = RequestHandler<
  ParamsDictionary,
  ApiSuccess<R>,
  unknown,
  ParsedQs,
  ValidatedLocals<T>
>

declare module 'express-serve-static-core' {
  interface Locals {
    requestId: string
    routeTemplate?: string
    errorCode?: ErrorCode
  }
}
