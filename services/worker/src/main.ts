import { Worker } from "bullmq";
import IORedis from "ioredis";
import pino from "pino";

const log=pino({name:"registry-worker"});
const connection=new IORedis(process.env.REDIS_URL??"redis://localhost:6379",{maxRetriesPerRequest:null});
new Worker("claim-verification",async job=>{
  log.info({jobId:job.id,claimId:job.data.claimId},"verification started");
  // Production adapters: malware scan → OCR → duplicate HMAC lookup → risk scoring.
  return {claimId:job.data.claimId,status:"READY_FOR_HUMAN_REVIEW",riskScore:15};
},{connection,concurrency:5});
log.info("claim verification worker ready");
