import type {Json,Member} from './familyTypes.ts';
import {id,invalid} from './familyProtocol.ts';
import {FamilyError} from './familyErrors.ts';
export type NotificationConfig={mode:'all'|'selected'|'none';members:string[]};
export function notificationConfig(mode:unknown,members:unknown,valid?:Member[]):NotificationConfig{
 if(!['all','selected','none'].includes(String(mode))||!Array.isArray(members)||members.length>100)invalid('NOTIFICATION_CONFIG');
 const ids=members.map(x=>id(x));if(new Set(ids).size!==ids.length)invalid('NOTIFICATION_CONFIG');
 if(mode==='selected'&&valid&&ids.some(key=>!valid.some(m=>m.memberId===key)))throw new FamilyError('INVALID_ASSIGNEE','NOTIFICATION_CONFIG','通知对象已离开或稳定成员ID不可用，请刷新成员并重新选择。');
 return{mode:mode as NotificationConfig['mode'],members:mode==='selected'?[...ids].sort():[]};
}
export function parseNotification(row:Json){if(row.notificationMode===undefined&&row.notificationMemberIds===undefined)return undefined;return notificationConfig(row.notificationMode,row.notificationMemberIds);}
