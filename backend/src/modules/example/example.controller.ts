import type { ValidatedHandler } from '../../types/http.js'
import { sendSuccess } from '../../utils/response.js'
import type {
  ListExampleInput,
  DetailExampleInput,
  ValidateExampleInput,
} from './example.schema.js'
import type {
  ExampleService,
  ExampleList,
  ExampleDetail,
  ExampleValidation,
} from './example.service.js'

export function createExampleController(service: ExampleService) {
  const list: ValidatedHandler<ListExampleInput, ExampleList> = async (_req, res) => {
    sendSuccess(res, await service.list(res.locals.validated.query.limit))
  }
  const detail: ValidatedHandler<DetailExampleInput, ExampleDetail> = async (_req, res) => {
    sendSuccess(res, await service.detail(res.locals.validated.params.code))
  }
  const validate: ValidatedHandler<ValidateExampleInput, ExampleValidation> = async (_req, res) => {
    sendSuccess(res, await service.validate(res.locals.validated.body))
  }
  return { list, detail, validate }
}
