import seed from "./prototype-seed.json" with {type:"json"};
import {shiftSeed} from "./fixtures.ts";
import {splitLegacyReviews} from "./single-problem-reviews.ts";
export function createPrototypeState(now=new Date()) {return splitLegacyReviews(shiftSeed(seed,now));}
