import type { State } from "./workflow.ts";
export type PrdState = State & { warningDecisions?: {findingId:string;detectionId:string;policyId:string;conditions:{stage:string};reason:string}[]; detectionResults?: {id:string;role:string;range:number[]}[] };
