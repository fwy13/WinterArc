export interface FundConfig { bank:string; accountNumber:string; accountName:string; paymentUrl:string; note:string; goal:number; revision:number }
export interface FundEntry { id:string; kind:'income'|'expense'; amount:number; title:string; date:string; receipt:string; created:number; voided:number; voidReason:string; source?:'bank'|'manual'; senderName?:string; message?:string; reference?:string; transactionAt?:string }
export interface FundReport { config:FundConfig; entries:FundEntry[]; total:number; page:number; income:number; expense:number; balance:number }
