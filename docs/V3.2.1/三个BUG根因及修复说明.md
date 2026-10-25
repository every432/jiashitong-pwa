# 三个BUG根因及修复说明

## 1. 成员账号昵称
确认的源码问题：云端family_member_profiles只接受userInfo.uid匹配且nickName为字符串；V3.2恢复绑定分支重复使用同一限制覆盖结果。原生认证资料/注册使用name字段，PWA资料适配接受nickName/name。字段或SDK结果不符合单一形状就统一标profileUnavailable。Android本人显示只用历史member.uid匹配profile.uid，恢复设备boundAuthUid不同会误判；即使本人资料可用仍显示云端profileUnavailable警告。

修复：统一本人身份按boundAuthUid，显示账号昵称和家庭称呼两行；空字符串明确“未设置账号昵称”，无字段/查询失败仍提示暂未读取；不把家庭称呼当账号昵称。候选云端层按boundAuthUid读取，通过UID核对后白名单提取nickName/nickname/name，保持最多5并发，不返回邮箱、电话或完整profile；保留原listMembers前后成员授权及V3.2绑定校验。

**证据边界**：已读本机线上导出ZIP，其SHA256仍为 D4C220B59973D3DEFEF3FC46271BDDD96EFB6592BE79F1DE872D3F5036C46471；未取得最新控制台调用日志或真实getEndUserInfo响应。因此不能认定所有手机问题都由字段名造成，也不能证明候选已上线。若服务端查询本身无权限，改字段不足以解决；只核对现有服务端SDK身份，不给Web管理权限。显式空字段与全部缺失区分，缺失不冒充“未设置”。

## 2. iOS邀请码 PASSWORD_LOGIN / SERVICE_ERROR
确认的源码问题：anonymousJoin catch及SDK匿名保护使用PASSWORD_LOGIN标签，掩盖失败位置；核销成功但响应丢失没有独立持久待核对状态。未发现证据证明实际调用了密码登录。
修复后阶段：CONFIG → RESTORE_SESSION（SDK已有会话恢复）→ ANONYMOUS_LOGIN → ANONYMOUS_PROFILE → WHO_AM_I → V32_CAPABILITIES → CONSUME_INVITE → JOIN_VERIFY。SDK仍为3.10.3，环境与上海地域未变。错误仅输出白名单码和固定文案，不输出凭据或原始服务端正文。
邀请码核销前将指纹/原家庭列表写入原加密待确认存储；不保存邀请码或家庭昵称明文。未知响应先读列表，不用新家庭列表猜测核销成功、不重发一次性核销。已获目标ID时只读核对成员关系。确实需要结束未知状态时，用户先与管理员核对目标家庭，再在“上次邀请码结果待核对”中确认，客户端重读权限后仅结束本机标记。
**实际iPhone失败尚未定位到唯一外部原因**。模拟503已证明正确显示ANONYMOUS_LOGIN且未发核销；合成HTTP下官方SDK匿名加入/恢复通过。实际Safari仍需新版错误阶段及控制台核对。

## 3. 红色角标
根因已确认：双端六板块直接读取v32Unread.byFamily.modules，统计的是历史未读变更事件，一条待办多次修改可以有12条消息；完成不等于阅读这些消息，因此不清零。这不是记录重复或需要删除通知数据库。
改为明确混合规则：todo=本人负责或未分配且未完成；shopping=家庭未采购记录；schedule=Asia/Shanghai本月尚未结束，没填结束时间按当日23:59；memo/notice/ledger=原服务端未读变更消息。消息中心及首页总未读继续表示消息，不承诺等于待办数量。
重新进入、前台/网络恢复同步后及写入后重读；Android增加刷新代次，拒绝迟到结果。家庭不同不混算，重复recordId不重复计数；分页快照变化或超过完整统计上限不显示部分统计。2000条以上显示统计暂未核实。未删除完成/历史/消息数据，也未自动标读。
