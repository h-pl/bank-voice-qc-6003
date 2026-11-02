# Moss Quality · 6003

银行语音质检交互原型。一个指标对应一个资源，配置形成一条规则；预警策略可关联多条规则。通话告警聚合问题，问题分别进入复核、申诉和整改，过程记录汇总为看板。

- PRD：[6003 飞书文档](https://acnc6zeentra.feishu.cn/wiki/HkzuwVO6RifzR8kMiLRcdtsJnAd)
- GitHub：[h-pl/bank-voice-qc-6003](https://github.com/h-pl/bank-voice-qc-6003)
- Vercel 发布项目：`bank-voice-qc-6003`。
- 本地：[localhost:6003](http://localhost:6003)
- [实施与验收记录](docs/6003/交付记录.md) · [页面方案](docs/6003/页面方案.txt)

## 运行

使用 Node.js 26 与 pnpm 11.25.0：

```sh
pnpm install --frozen-lockfile
pnpm dev
```

```sh
pnpm typecheck
pnpm lint
pnpm test:workflow
pnpm build
```

## 实现

指标只开启或关闭，全部接入通话使用所有已开启规则。业务资源只查看与编辑，校验后直接保存。专业性资源包含 SOP 与业务知识两个区，语言表达资源维护声学参数。策略配置等级、通知接收人、重复提醒间隔、默认或特殊流程；通知统一进入通知中心和提醒列表，规则最多关联一条策略。

新检测保存当时的资源依据。重复回调追加证据，同通话多个问题共用一条告警。在办问题保留命中时的策略关联，并按原策略当前等级重算；规则换绑仅影响新问题，删除策略后由归档配置保留旧问题口径，降级保留原期限。所有问题办结且检测完成后关闭告警，新增问题沿用原告警编号重开。

`lib/configuration.ts` 负责配置校验与保存；`lib/call-alerts.ts` 负责检测回调、聚合及流程选择；`lib/workflow.ts` 负责三角色办理；`lib/reports.ts` 提供报表、下钻与导出共用口径。

当前数据层使用浏览器本地存储，角色切换与预置检测结果用于流程验收。正式组织认证、模型检测、附件存储与外部消息服务沿 PRD 接口接入。默认预警为中等级、主管提醒；特殊流程提供“优先质检员检查”供流程验收，正式业务模板由业务确认。

本仓库从 6001 源码提交 `d40dee7` 建立独立快照。开发与部署只维护本仓库及同名 Vercel 项目。
