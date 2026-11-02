import type { Resource } from "./workflow.ts";
export const indicatorRuleCategories=[
 ["6.2.1","声纹识别"],["6.2.2","语音识别"],["6.2.3","关键词检出"],["6.2.4","文本纠错"],["6.2.5","情绪识别"],["6.2.6","意图识别"],
 ["6.3.5","服务礼仪"],["6.3.6","语言表达"],["6.3.7","专业性"],["6.3.8","隐私性"],["6.3.9","禁用词"],["6.3.10","消极情感"],
];
export const indicatorName=(id:string)=>indicatorRuleCategories.find(([key])=>key===id)?.[1] ?? (id==="6.3.4"?"风险上报与干预":id);
export const indicatorRuleName=(id:string)=>`${indicatorName(id)}规则`;
export const supportsWarning=(indicator:string)=>indicatorRuleCategories.some(([id])=>id===indicator) && !["6.2.2","6.2.4"].includes(indicator);
// Keep the existing order within each group and leave stored configuration untouched.
export const sortByStrategyRequirement=<T extends {indicator:string}>(items:readonly T[]):T[]=>
 [...items].sort((a,b)=>Number(supportsWarning(b.indicator))-Number(supportsWarning(a.indicator)));
export type ResourceSchema={name:string;group:Resource["type"];fields:string[];required:number[];rows:string[][];csv:boolean;indicator:string;note?:string};
export const resourceSchemas:Record<string,ResourceSchema>={
 voice:{name:"声纹库",group:"业务知识",fields:["坐席/工号","注册语音","启用状态"],required:[0,1,2],rows:[["A1048","A1048-注册语音.wav","启用"],["A1186","A1186-注册语音.wav","停用"]],csv:false,indicator:"6.2.1"},
 hotword:{name:"识别热词",group:"词库",fields:["词条"],required:[0],rows:["慧盈存","惠民贷","跨行汇款","对公账户","自动还款","信用卡分期","大额存单"].map(x=>[x]),csv:true,indicator:"6.2.2"},
 keyword:{name:"关键词库",group:"词库",fields:["关键词","同义词"],required:[0],rows:[["投诉","申诉；我要投诉"],["提前还款","提前结清"],["挂失","卡丢了；遗失银行卡"],["费用争议","乱扣费"],["转账失败","汇款失败"],["账户冻结","账户受限"]],csv:true,indicator:"6.2.3"},
 correction:{name:"纠错词库",group:"词库",fields:["易错文本","正确文本"],required:[0,1],rows:[["跨行会款","跨行汇款"],["帐单日","账单日"],["慧赢存","慧盈存"]],csv:true,indicator:"6.2.4"},
 emotion:{name:"情绪标签",group:"业务知识",fields:["情绪名称","情绪描述"],required:[0,1],rows:[["愤怒","强烈不满、激动或愤怒的表达"],["焦虑","反复担忧结果、催促确认"],["悲伤","低落或悲伤的表达"],["平静","情绪稳定、正常交流"]],csv:false,indicator:"6.2.5",note:"使用已交付标签，可维护业务说明；不支持新增模型尚未提供的情绪。"},
 intent:{name:"意图定义",group:"业务知识",fields:["意图名称","定义","正例","反例"],required:[0,1],rows:[["查询转账进度","确认已提交转账的状态","我昨天的转账到了吗","我想现在转一笔钱"],["办理挂失","申请挂失遗失的银行卡","我的卡丢了需要挂失","我找到了之前的卡"]],csv:true,indicator:"6.2.6"},
 etiquette:{name:"服务礼仪规范",group:"业务知识",fields:["检查项名称","必说要素","允许表达","例外表达"],required:[0,1],rows:[["开场问候","问候；银行身份；工号","您好，银行客服，工号1048","客户直接说明紧急挂失"],["结束确认","确认其他需求；致谢","还有其他可以帮您的吗","客户提前挂断"]],csv:true,indicator:"6.3.5"},
 sop:{name:"SOP 规则集合",group:"SOP",fields:["SOP名称","步骤序号","步骤内容","是否必需"],required:[0,1,2,3],rows:[["身份核验","1","确认客户当前诉求","是"],["身份核验","2","通过安全渠道核验身份","是"],["身份核验","3","确认核验成功后办理业务","是"],["挂失办理","1","确认遗失卡片信息","是"],["挂失办理","2","完成挂失登记并告知结果","是"],["挂失办理","3","说明补卡方式","否"]],csv:true,indicator:"6.3.7"},
 knowledge:{name:"业务知识",group:"业务知识",fields:["知识主题","知识内容","依据名称"],required:[0,1],rows:[["转账进度查询","完成身份核验后查询处理状态，不作无依据到账承诺","业务口径"],["账单争议处理","核对账期和交易明细，说明争议登记渠道","服务规范"]],csv:true,indicator:"6.3.7"},
 privacy:{name:"隐私规则",group:"业务知识",fields:["规则名称","信息类型","禁止行为","正例","反例","脱敏要求"],required:[0,1,2],rows:[["禁止索取验证码","短信验证码","索取完整验证码","请把六位验证码告诉我","请勿向任何人透露验证码","全部遮蔽"],["限制披露卡号","银行卡号","未经核验披露完整卡号","您的完整卡号是…","核验后确认卡号尾四位","仅显示后四位"]],csv:true,indicator:"6.3.8"},
 banned:{name:"禁用词库",group:"词库",fields:["禁用词","类别","例外"],required:[0],rows:[["保证立即到账","过度承诺","引用客户原话或否定表述"],["绝对没有费用","过度承诺","说明不能承诺无费用"],["别再问了","不当表达","转述客户原话"]],csv:true,indicator:"6.3.9"},
 attitude:{name:"服务态度规范",group:"业务知识",fields:["表现名称","判定说明","正例","反例","例外"],required:[0,1],rows:[["推诿","拒绝说明后续处理渠道并转嫁责任","你自己去找对方吧","我为您查询负责团队并说明联系方式","按流程转接且说明原因"],["敷衍","未回应核心问题且重复无关回答","都说过了就这样吧","我再为您确认具体原因","客户反复要求无法承诺的结果"]],csv:true,indicator:"6.3.10"},
};

resourceSchemas.expression={name:"语言表达参数",group:"业务知识",fields:["表达特征","说明"],required:[0,1],rows:[["静默","连续无语音"]],csv:true,indicator:"6.3.6"};
