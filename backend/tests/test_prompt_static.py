"""提示詞靜態檢查（不呼叫 API）：提示詞要提到所有輸出欄位與輸入區塊。詳見 tests/prompt_eval/README.md"""

import pytest

from tests.prompt_eval.static_checks import static_checks

RESULTS = static_checks()


@pytest.mark.parametrize(("who", "check"), RESULTS, ids=[f"{w}:{c.name}" for w, c in RESULTS])
def test_prompt_static(who, check) -> None:
    assert check.passed, f"{who}：{check.name}｜{check.detail}"
