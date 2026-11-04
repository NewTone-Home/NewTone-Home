# 本轮阶段A：包墙框、六桌、绿植与真实卫生间

三店接受的柜台/工作台实体未改变；仅柜台outlineBounds延伸到接墙中心外14参考像素，描边包住墙字，命中/碰撞仍用原身体，L空心不填。Cafe原四桌坐标/剧情ID保留，新增(448,322)/(588,322)，椅中心偏移22→30，实体净缝6→14，外侧拉椅点44→52。主角真实11px可容14缝，NPC16不可容；新增12条显式非占位桌椅关系线禁止横穿，而非扩大空气碰撞。两盆角落绿植(644,84)/(644,644)仅查看。

新增Cafe后墙外168×168单人卫生间，处于已有world walkBounds预留范围，未扩大场景。便器/洗手盆有字符碰撞，复用原toilet门ID连接Cafe与同世界新room，不新增scene/save ID，员工后门仍锁。卫生间三字招牌靠近翻为墙门墙。共享门面连接允许非corridor母房间；仅嵌套门保留实际Cafe内approach/端点，避免按外墙法线重算到卫生间里。原14店街侧规则不变。useStorefrontPresentation在母店保持外门揭示、子门正常近距生命周期，避免室内强制单owner压掉子门动画。

定向：CafeSixRestroom、storefrontRoomConnection、cafeAccessFeedback、cafeSeating；具体JSON .tmp/cafe-six-restroom-tests-final.json。旧四桌/6缝断言按六桌/14缝迁移，保留真实字符尺寸和坐起合法性；连接测试原房间中心现落果茶加宽柜台里，改用真实可走入口落点，不将solid起点当回归。新增断言检查描边与物理端点分离、12座、两种footprint均不可横穿缝、同世界双向卫生间/保存幂等。

类型/构建通过，首轮真实Chrome卫生间桌面及模拟手机各三次进入返回/室内刷新已通过；补修内向门面后桌面明确baseline→revealed成功，手机第二轮仍在执行，不冒称全验完。本阶段4226构建 .tmp/cafe-six-wall-wrap-dist 保留。三店首图 .tmp/six-simple-padded-L-counter-browser，卫生间图 .tmp/cafe-restroom-browser；未上传。

下一阶段才将商业街14店内部净深22+前后墙总24锚点落实，并联动家具与旧档；本阶段没有改深度常量。全部未发布、未push，矿区dirty与相机分支不动。
