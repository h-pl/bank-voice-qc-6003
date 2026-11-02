import { ResourceRowsTable } from "./structured-resource";
import type { Resource } from "../lib/workflow";
export function ResourceContent({resource}: {resource:Resource}) { return <><ResourceRowsTable kind={resource.kind === "professional" ? "sop" : resource.kind} content={resource.content}/>{resource.knowledge && <section><h4>业务知识</h4><ResourceRowsTable kind="knowledge" content={resource.knowledge}/></section>}</>; }
