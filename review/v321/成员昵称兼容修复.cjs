'use strict';
// 仅替换已通过成员权限校验的 listMembers 昵称补充层，不开放任意UID查询。
function nicknameFromProfile(result, expectedUid) {
  if(result?.code || result?.error)return null;
  const profile=result?.userInfo;
  if(!profile || profile.uid!==expectedUid)return null;
  const values=['nickName','nickname','name'].map(key=>profile[key]);
  // 三种是SDK/原生认证的显示名称字段；绝不使用username或displayName替代。
  const nickname=values.find(v=>typeof v==='string'&&v.trim());
  if(nickname!==undefined)return nickname;
  if(values.some(v=>typeof v==='string'))return '';
  // 缺失所有字段不能证明未设置，保留读取失败状态。
  return null;
}
async function enrichFamilyMembers(rows,ownerUid,auth,publicMember){
 const members=new Array(rows.length);let next=0;
 const supported=typeof auth.getEndUserInfo==='function';
 async function worker(){while(next<rows.length){const i=next++,row=rows[i];
  const item={...publicMember(row,ownerUid),accountNickname:null,profileUnavailable:true};
  if(supported)try{const uid=row.boundAuthUid||row.uid;const nickname=nicknameFromProfile(await auth.getEndUserInfo(uid),uid);
   if(nickname!==null){item.accountNickname=nickname;item.profileUnavailable=false;}
  }catch{ /* 不输出认证资料、错误正文或凭据。 */ }
  members[i]=item;
 }}
 await Promise.all(Array.from({length:Math.min(5,rows.length)},worker));
 return{members,accountProfilesSupported:supported};
}
module.exports={enrichFamilyMembers,nicknameFromProfile};
