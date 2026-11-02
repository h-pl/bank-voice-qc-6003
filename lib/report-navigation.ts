export const reportModules = [
  {id:"overview", title:"质检概览", description:"查看通话处理、质量变化与当前确认问题。"},
  {id:"issues", title:"问题分布", description:"按指标与判定结果定位质量问题。"},
  {id:"teams", title:"坐席 / 班组", description:"查看坐席工作量及班组问题分布。"},
  {id:"improvement", title:"申诉与整改", description:"查看期间申诉裁定、按时办结结果与整改状态。"},
] as const;
export type ReportModule = typeof reportModules[number]["id"];
export const readReportModule = (value:string | null | undefined):ReportModule => reportModules.find(module=>module.id===value)?.id ?? "overview";
export const reportModuleTitle = (value:ReportModule) => reportModules.find(module=>module.id===value)!.title;
