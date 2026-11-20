"""所有 API 資料格式的共同基底。

前端（TypeScript）使用 camelCase，Python 端使用 snake_case：
- 收到請求時兩種寫法都接受
- 回傳時一律輸出 camelCase，與 frontend/src/types 一致
"""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ErrorBody(ApiModel):
    """錯誤回應格式，對應前端 services/http/client.ts 的 {code, message}"""

    code: str
    message: str
