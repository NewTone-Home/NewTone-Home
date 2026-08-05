# First release content and English copy review

## Approved narrative sources

| Language | Source file | SHA-256 | Narrative paragraphs |
| --- | --- | --- | ---: |
| Chinese | `修杰1.txt` | `96884674aa7ab4737c188c67fa3c52244acb2591bcee67a0cad7c31e81a5fdf3` | 58 |
| English | `Xiujie_Chapter_1_EN.md` | `ce3e83c35c21d8d96cb670aed15fd99af2a6d7e458ca0b9b7aae70814653e4a1` | 59 |

The importer decodes UTF-8, normalizes CRLF to LF, stores each H1 as chapter metadata, and excludes the English blockquote source notes from the narrative body. It rejects the import unless rebuilding the paragraphs produces the exact normalized body. No narrative sentence is translated, edited, merged, or invented. Chinese paragraph 39 maps to the two corresponding English paragraphs; every other Chinese paragraph maps one-to-one.

## Pagination and explicit environment evidence

| Page | Chinese setting | English setting | Paragraph range | World | Time | Weather | Light |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | 姬家祖宅外院 | Ji ancestral residence — courtyard | 1–10 | surface | unspecified | clear | neutral |
| 2 | 姬家祖宅正厅 | Ji ancestral residence — main hall | 11–19 | surface | unspecified | unspecified | interior dim |
| 3 | 暗道 | Hidden passage | 20–25 | surface | unspecified | unspecified | passage dark |
| 4 | 世界联合会办公室 | World Concordat office | 26–32 | inner | unspecified | clear | threshold white |
| 5 | 里世界商业区咖啡店 | Inner World shopping district — café | 33–38 | inner | unspecified | clear | threshold white |
| 6 | 里世界商业街 | Inner World shopping street | 39–58 | inner | unspecified | clear | threshold white |

`unspecified` is deliberately stored where the source does not state a value. The Reader uses a neutral visual fallback without turning that fallback into authored metadata.

## English UI copy map

| Surface/key | Chinese reference | Previous English | Final English |
| --- | --- | --- | --- |
| Landing / initial | 向下滚动 · 开始读取 | scroll down · begin reading | Scroll down to begin |
| Landing / resume | 向下滚动 · 继续读取 | scroll down · continue reading | Scroll down to continue |
| Continue reading | 继续读取 | scroll down · continue reading | Continue reading |
| Language title | 文本层已接入：当前语言 | text layer · current language | Reading language |
| Language proceed | 继续读取 | continue | Continue |
| Language change | 是否变更 | change | Change language |
| Mode title | 环境层已接入 | environment layer · connected | Choose your reading experience |
| Immersive mode | 沉浸叙事 | immersive narrative | Immersive |
| Standard mode | 普通阅读 | standard reading | Classic |
| Start transition | 开始读取 | begin reading | Opening Reader |
| Resume transition | 回读中 | resuming | Returning to your place |
| Return transition | 返回入口中 | returning to entrance | Returning to the entrance |
| Scroll hint | 向下滚动 · 继续读取 | scroll down · continue reading | Scroll down to continue |
| Reset | 重置 | reset | Reset |
| Back to landing | 返回入口 | back to entrance | Return to entrance |
| Back home | 返回首页 | back to home | Return home |
| Reader settings | 阅读设置 | reading settings | Reader settings |
| Language | 语言 | language | Language |
| Select language | 选择语言 | select language | Choose a language |
| Switch language | 切换到 | switch to | Switch to |
| Reading mode | 阅读模式 | reading mode | Reading experience |
| Immersive label | 沉浸叙事 | immersive narrative | Immersive |
| Standard label | 普通阅读 | standard reading | Classic |
| Standard background | 普通阅读背景 | standard reading background | Reading background |
| Standard theme | 普通阅读主题 | standard reading theme | Reading theme |
| Theme | 主题 | theme | Theme |
| Bright theme | 明亮 | bright | Light |
| Soft theme | 柔和 | soft | Warm |
| Night theme | 夜间 | night | Dark |
| Progress | 阅读进度 | reading progress | Reading progress |
| Pointed progress | 所指进度 | pointed progress | Selected progress |
| Current scene | 当前场景 | current scene | Current setting |
| Return control | 返回入口 | Return to Entrance | Return to entrance |
| Return hold hint | 持续悬停返回入口 | Keep hovering to Return to Entrance | Keep hovering to return |
| Reader tutorial | 向下前行 · 向上回看 | down to continue · up to revisit | Scroll down to continue · scroll up to revisit |
| Empty Reader title | 暂无可读页面 | No readable page | No pages are available yet |
| Empty Reader message | 正文尚未发布… | The body has not been published… | The story has not been published yet. You can still explore the Reader settings. |
| Empty Reader retry | 重新检查正文 | Check again | Try again |
| Loading | 正在确认已发布正文… | — | Preparing the latest chapter… |
| Transition world label | 世界层 | world layer | World |
| Transition location label | 地点 | location | Setting |
| Transition missing value | 未标明 | not specified | Not specified |

Legacy English scene labels were also changed from lowercase technical labels to natural setting labels, for example `inner-world commercial street` → `Inner World · Shopping street` and `Ji ancestral home · main hall` → `Ji ancestral residence · Main hall`.

The private admin surface keeps its operating copy primarily in Chinese. Mixed literal labels were cleaned up: `Owner session` → `管理员已登录`, `Owner 工作台` → `管理员工作台`, `发送 Magic Link` → `发送登录链接`, and `Supabase owner 草稿` → `Supabase 管理员草稿`. English-only field labels use natural editorial English: `Chapter title (English)`, `Setting (English)`, `Current page in English`, and `Full chapter in English`.
