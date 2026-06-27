import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, updateDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js";
import { getAuth, createUserWithEmailAndPassword, onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app=initializeApp(firebaseConfig),db=getFirestore(app),storage=getStorage(app),auth=getAuth(app);
const $=id=>document.getElementById(id);
const esc=v=>String(v??"");
const money=v=>Number(String(v||"").replace(/[^\d]/g,""))||0;
const won=n=>(Number(n)||0).toLocaleString()+"원";

let state={
  products:[], prices:[], notices:[], reviews:[], coupons:[], orders:[], bookings:[], banners:[], benefits:[], settings:[], consultRecords:[], spiritualRequests:[], notifications:[], schedules:[], chats:[], points:[], pointSettings:[], supportTickets:[], faqs:[], reservationBlocks:[], activityLogs:[], refundLogs:[], consultationReports:[], crmProfiles:[], adminRoles:[], realtimeAlerts:[], visitorSessions:[], storageFiles:[], calendarEvents:[], eventGameSettings:[], aiSummaries:[], errorLogs:[], cacheSettings:[], paymentSettings:[], paymentReceipts:[], orderStatusLogs:[], consultAudioFiles:[], crmProProfiles:[], marketingSettings:[], securitySettings:[], aiProReports:[], pushSettings:[], syncHealth:[], uiSettings:[], memberGrowthSettings:[], consultOps:[], scheduleSettings:[], automationLogs:[], builderSections:[], auditLogs:[], wishlists:[], recentViews:[], restockAlerts:[], chatStatuses:[], events:[], memberFiles:[], seoSettings:[], adminRoles:[], epostShipments:[],
  payment:{name:"천율도령",account:"02002407816",guide:"송금 후 주문 신청"},
  booking:{times:["오전 10시","오후 2시","오후 7시"],blockedDates:[]}
};
let cart=JSON.parse(localStorage.cyMobileCart||"[]");
let coupon=null, couponDiscount=0, user=null, member=null;
let favorites=JSON.parse(localStorage.cyFavorites||"[]");
let recentViewed=JSON.parse(localStorage.cyRecentViewed||"[]");
let started=false;


// ===== 4.5 complete sync additions =====
function getBusiness(){
  const b=state.settings.find(s=>s.id==="business")||{};
  return {
    name:b.name||"천율도령", owner:b.owner||"정세진", number:b.number||"570-76-00713",
    address:b.address||"경상북도 구미시 상모로12길 49, 101동 102호",
    type:b.type||"협회 및 단체, 수리 및 기타 개인서비스업", item:b.item||"점술 및 유사 서비스업",
    contact:b.contact||"카카오톡 오픈프로필 천율도령", mailOrder:b.mailOrder||"신고 예정"
  };
}
function renderBusiness(){
  const box=$("businessInfoHome"); if(!box) return;
  const b=getBusiness();
  box.innerHTML=`<p>상호: ${esc(b.name)}</p><p>대표자: ${esc(b.owner)}</p><p>사업자등록번호: ${esc(b.number)}</p><p>주소: ${esc(b.address)}</p><p>업태: ${esc(b.type)}</p><p>종목: ${esc(b.item)}</p><p>고객문의: ${esc(b.contact)}</p><p>통신판매업신고: ${esc(b.mailOrder)}</p>`;
}
function couponValid(c){
  if(c.minOrder && subtotal() < money(c.minOrder)) return `최소 주문금액 ${won(money(c.minOrder))} 이상 사용 가능합니다.`;
  if(c.expiresAt){
    const exp = String(c.expiresAt);
    const today = new Date().toISOString().slice(0,10);
    if(exp < today) return "만료된 쿠폰입니다.";
  }
  if(c.useLimit && Number(c.usedCount||0) >= Number(c.useLimit)) return "사용 가능 횟수를 초과한 쿠폰입니다.";
  return "";
}
async function decreaseStockAfterOrder(){
  for(const item of cart){
    if(item.type!=="product") continue;
    const p=state.products.find(x=>x.id===item.id);
    if(!p) continue;
    const stock = Number(String(p.stock||"").replace(/[^\d]/g,""));
    if(Number.isFinite(stock) && stock > 0){
      await updateDoc(doc(db,"products",p.id),{stock:String(Math.max(0,stock-item.qty)),updatedAt:serverTimestamp()});
    }
  }
}
function isBooked(date,time){return state.bookings.some(b=>b.date===date && b.time===time && !String(b.status||"").includes("취소")) || (state.reservationBlocks||[]).some(b=>b.date===date && b.time===time);}


// ===== 4.6 operation complete additions =====
async function submitSpiritual(){
  if(!$("spName").value || !$("spContact").value) return alert("이름과 연락처를 입력해 주세요.");
  await addDoc(collection(db,"spiritualRequests"),{
    name:$("spName").value, contact:$("spContact").value, type:$("spType").value,
    amount:$("spAmount").value, body:$("spBody").value,
    memberUid:member?.uid||member?.id||"", memberEmail:member?.email||"",
    status:"신청접수", createdAt:serverTimestamp()
  });
  await addDoc(collection(db,"notifications"),{target:"admin",title:"부적/초발원 신청 알림",body:`${$("spName").value} / ${$("spType").value}`,createdAt:serverTimestamp()});
  alert("신청이 접수되었습니다.");
}
function renderConsultRecords(){
  const box=$("myConsultRecords"); if(!box) return;
  if(!member){box.innerHTML="<p>로그인 후 상담 이력을 확인할 수 있습니다.</p>"; return;}
  const uid=member.uid||member.id;
  const rows=(state.consultRecords||[]).filter(r=>r.memberUid===uid || r.memberEmail===member.email);
  box.innerHTML=rows.length?rows.map(r=>`<article class="card"><h3>${esc(r.title||"상담 이력")}</h3><p>${esc(r.date||"")}</p><p>${esc(r.memo||"")}</p>${r.nextDate?`<p>재상담 예정: ${esc(r.nextDate)}</p>`:""}</article>`).join(""):"<p>등록된 상담 이력이 없습니다.</p>";
}
async function requestRefund(col,id){
  const reason=prompt("환불/취소 사유를 입력해 주세요.");
  if(reason===null)return;
  await updateDoc(doc(db,col,id),{status:"환불요청",refundReason:reason,refundRequestedAt:serverTimestamp()});
  alert("환불/취소 요청이 접수되었습니다.");
}


// ===== 4.7 CRM / Dashboard / Alerts additions =====
function renderNotifications(){
  const box=$("myNotifications"); if(!box) return;
  if(!member){box.innerHTML="<p>로그인 후 알림을 확인할 수 있습니다.</p>";return;}
  const uid=member.uid||member.id;
  const rows=(state.notifications||[]).filter(n=>n.memberUid===uid || n.memberEmail===member.email || n.target==="all");
  box.innerHTML=rows.length?rows.slice(0,10).map(n=>`<article class="card ${n.read?'':'highlightCard'}"><h3>${esc(n.title||"알림")}</h3><p>${esc(n.body||"")}</p><small>${n.createdAt?.seconds?new Date(n.createdAt.seconds*1000).toLocaleString():""}</small></article>`).join(""):"<p>새 알림이 없습니다.</p>";
}
function renderProgressCenter(){
  const box=$("myProgressList"); if(!box) return;
  if(!member){box.innerHTML="<p>로그인 후 진행 현황을 확인할 수 있습니다.</p>";return;}
  const uid=member.uid||member.id;
  const spirituals=(state.spiritualRequests||[]).filter(s=>s.memberUid===uid||s.memberEmail===member.email||s.contact===member.contact);
  const orders=(state.orders||[]).filter(o=>o.memberUid===uid||o.memberEmail===member.email||o.contact===member.contact);
  const bookings=(state.bookings||[]).filter(b=>b.memberUid===uid||b.memberEmail===member.email||b.contact===member.contact);
  box.innerHTML=[
    ...spirituals.map(s=>`<article class="card"><h3>${esc(s.type||"신청")}</h3><p>상태: ${esc(s.status||"접수")}</p><p>${esc(s.body||"")}</p></article>`),
    ...orders.map(o=>`<article class="card"><h3>주문 ${esc(o.orderNo||"")}</h3><p>상태: ${esc(o.status||"")}</p><p>배송: ${esc(o.trackingCompany||"등록 전")} ${esc(o.trackingNo||"")}</p></article>`),
    ...bookings.map(b=>`<article class="card"><h3>${esc(b.type||"상담 예약")}</h3><p>${esc(b.date)} ${esc(b.time)}</p><p>상태: ${esc(b.status||"")}</p></article>`)
  ].join("") || "<p>진행 중인 내역이 없습니다.</p>";
}


// ===== 4.8 chat / points / referral additions =====
function referralCode(){
  if(!member) return "";
  return "CY" + String(member.uid||member.id||"").slice(0,6).toUpperCase();
}
function renderReferral(){
  const box=$("myReferralBox"); if(!box) return;
  if(!member){box.innerHTML="로그인 후 추천인 코드를 확인할 수 있습니다.";return;}
  box.innerHTML=`<h3>내 추천인 코드</h3><div class="price">${referralCode()}</div><p>친구가 이 코드를 입력하면 추천 보상이 지급될 수 있습니다.</p><p>보유 적립금: <b>${won(Number(member.points||0))}</b></p>`;
}
async function saveReferralCode(){
  if(!member)return alert("로그인 후 이용해 주세요.");
  const code=($("referralInput").value||"").trim().toUpperCase();
  if(!code)return alert("추천인 코드를 입력해 주세요.");
  if(member.referredBy)return alert("이미 추천인을 등록했습니다.");
  await updateDoc(doc(db,"members",member.uid||member.id),{referredBy:code,updatedAt:serverTimestamp()});
  await addDoc(collection(db,"notifications"),{target:"admin",title:"추천인 등록",body:`${member.name||member.email} / ${code}`,createdAt:serverTimestamp()});
  alert("추천인이 등록되었습니다.");
}
function renderPointHistory(){
  const box=$("pointHistory"); if(!box) return;
  if(!member){box.innerHTML="<p>로그인 후 확인 가능합니다.</p>";return;}
  const uid=member.uid||member.id;
  const rows=(state.points||[]).filter(p=>p.memberUid===uid||p.memberEmail===member.email);
  box.innerHTML=rows.length?rows.map(p=>`<article class="card"><h3>${Number(p.amount||0)>=0?"+":""}${won(Number(p.amount||0))}</h3><p>${esc(p.reason||"적립금")}</p><small>${p.expiresAt?`만료일: ${p.expiresAt}`:""}</small></article>`).join(""):"<p>적립금 내역이 없습니다.</p>";
}
function renderEvents(){
  if($("homeBenefitList")){
    const eventCards=(state.events||[]).slice(0,3).map(e=>`<article class="card benefitCard"><h3>${esc(e.title||"이벤트")}</h3><p>${esc(e.body||"")}</p><small>종료일: ${esc(e.endDate||"-")}</small></article>`).join("");
    if(eventCards) $("homeBenefitList").innerHTML=eventCards + $("homeBenefitList").innerHTML;
  }
}
function chatThreadId(){return member ? (member.uid||member.id) : "";}
function renderChat(){
  const guide=$("chatLoginGuide"), box=$("chatBox"); if(!box) return;
  if(!member){ if(guide)guide.style.display="block"; box.innerHTML=""; return; }
  if(guide)guide.style.display="none";
  const uid=chatThreadId();
  const rows=(state.chats||[]).filter(c=>c.threadId===uid).sort((a,b)=>(a.createdAt?.seconds||0)-(b.createdAt?.seconds||0));
  box.innerHTML=rows.map(m=>`<div class="msg ${m.sender==='admin'?'adminMsg':'userMsg'}"><b>${m.sender==='admin'?'천율도령':'나'}</b><p>${esc(m.text||"")}</p></div>`).join("")||"<p>상담 메시지를 남겨주세요.</p>";
  box.scrollTop=box.scrollHeight;
}
async function sendChat(){
  if(!member)return alert("로그인 후 이용해 주세요.");
  const text=($("chatInput").value||"").trim(); if(!text)return;
  await addDoc(collection(db,"chats"),{threadId:chatThreadId(),memberUid:member.uid||member.id,memberEmail:member.email,memberName:member.name||"",sender:"user",text,read:false,createdAt:serverTimestamp()});
  await addDoc(collection(db,"notifications"),{target:"admin",title:"새 채팅 메시지",body:`${member.name||member.email}: ${text}`,createdAt:serverTimestamp()});
  $("chatInput").value="";
}


// ===== 5.0 full platform additions =====
function renderMemberFiles(){
  const box=$("myFilesList"); if(!box) return;
  if(!member){box.innerHTML="<p>로그인 후 상담 자료를 확인할 수 있습니다.</p>";return;}
  const uid=member.uid||member.id;
  const rows=(state.memberFiles||[]).filter(f=>f.memberUid===uid||f.memberEmail===member.email);
  box.innerHTML=rows.length?rows.map(f=>`<article class="card"><h3>${esc(f.title||"상담 자료")}</h3><p>${esc(f.memo||"")}</p>${(f.urls||[]).map((u,i)=>`<a class="secondary fileLink" target="_blank" href="${u}">자료 ${i+1} 열기</a>`).join("")}</article>`).join(""):"<p>등록된 자료가 없습니다.</p>";
}
function renderReceipts(){
  const box=$("myReceiptList"); if(!box)return;
  if(!member){box.innerHTML="<p>로그인 후 확인 가능합니다.</p>";return;}
  const uid=member.uid||member.id;
  const rows=(state.orders||[]).filter(o=>o.memberUid===uid||o.memberEmail===member.email||o.contact===member.contact);
  box.innerHTML=rows.length?rows.map(o=>`<article class="card receipt"><h3>주문서 ${esc(o.orderNo||"")}</h3><p>주문자: ${esc(o.name||"")}</p><p>금액: ${esc(o.total||"")}</p><p>상태: ${esc(o.status||"")}</p><button class="secondary" onclick="window.print()">인쇄/저장</button></article>`).join(""):"<p>주문 내역이 없습니다.</p>";
}
function applySeo(){
  const s=(state.seoSettings||[])[0];
  if(!s)return;
  if(s.title) document.title=s.title;
  let d=document.querySelector('meta[name="description"]'); if(d&&s.desc)d.setAttribute("content",s.desc);
}


// ===== 5.1 우체국 익일특급 배송조회 additions =====
async function epostTrackDirect(no){
  const settings = state.settings.find(s=>s.id==="epost") || {};
  if(!settings.trackEndpoint){
    return {ok:false,message:"우체국 배송조회 API 서버 URL이 아직 설정되지 않았습니다."};
  }
  try{
    const res = await fetch(settings.trackEndpoint, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({trackingNo:no})
    });
    return await res.json();
  }catch(e){
    return {ok:false,message:"배송조회 서버 연결 실패: "+e.message};
  }
}
async function handleEpostTrack(){
  const no=($("epostTrackNo")?.value||"").trim();
  if(!no)return alert("우체국 송장/등기번호를 입력해 주세요.");
  const box=$("epostTrackResult");
  if(box)box.innerHTML="<p>조회 중입니다...</p>";
  const r=await epostTrackDirect(no);
  if(box)box.innerHTML=r.ok?`<article class="card"><h3>${esc(no)}</h3><p>상태: ${esc(r.status||"조회완료")}</p><p>${esc(r.message||"")}</p>${(r.history||[]).map(h=>`<p>${esc(h.date||"")} ${esc(h.place||"")} ${esc(h.status||"")}</p>`).join("")}</article>`:`<article class="card"><h3>조회 실패</h3><p>${esc(r.message||"API 설정 필요")}</p></article>`;
}
function renderMyEpost(){
  const box=$("myEpostList"); if(!box)return;
  if(!member){box.innerHTML="<p>로그인 후 내 배송을 확인할 수 있습니다.</p>";return;}
  const uid=member.uid||member.id;
  const rows=(state.epostShipments||[]).filter(s=>s.memberUid===uid||s.memberEmail===member.email||s.contact===member.contact);
  box.innerHTML=rows.length?rows.map(s=>`<article class="card"><h3>우체국 익일특급</h3><p>주문번호: ${esc(s.orderNo||"")}</p><p>송장번호: ${esc(s.trackingNo||"발급 전")}</p><p>상태: ${esc(s.status||"접수대기")}</p><p>예상도착: ${esc(s.expectedArrival||"발송 다음 영업일")}</p></article>`).join(""):"<p>우체국 배송 내역이 없습니다.</p>";
}


// ===== 5.2 points automation complete =====
let pointUseAmount = 0;

function getPointSettings(){
  const s=(state.pointSettings||[])[0] || {};
  return {
    orderRate:Number(s.orderRate ?? 1),
    consultRate:Number(s.consultRate ?? 1),
    reviewPoint:Number(s.reviewPoint ?? 1000),
    signupPoint:Number(s.signupPoint ?? 1000),
    birthdayPoint:Number(s.birthdayPoint ?? 3000),
    expireDays:Number(s.expireDays ?? 365),
    minUse:Number(s.minUse ?? 1000),
    maxUseRate:Number(s.maxUseRate ?? 50)
  };
}
function currentPoints(){
  const uid=member?.uid||member?.id;
  if(!uid) return 0;
  return (state.points||[])
    .filter(p=>(p.memberUid===uid || p.memberEmail===member.email) && p.status!=="cancelled")
    .reduce((s,p)=>s+Number(p.amount||0),0);
}
function maxPointCanUse(){
  const set=getPointSettings();
  const maxByOrder=Math.floor(subtotal()*set.maxUseRate/100);
  return Math.max(0, Math.min(currentPoints(), maxByOrder));
}
function applyPointUse(){
  if(!member) return alert("로그인 후 적립금을 사용할 수 있습니다.");
  const set=getPointSettings();
  const val=Number(String($("pointUseInput")?.value||"").replace(/[^\d]/g,""))||0;
  if(val<=0){pointUseAmount=0; renderCart(); return;}
  if(val<set.minUse) return alert(`적립금은 최소 ${won(set.minUse)}부터 사용할 수 있습니다.`);
  const max=maxPointCanUse();
  if(val>max) return alert(`사용 가능한 최대 적립금은 ${won(max)}입니다.`);
  pointUseAmount=val;
  renderCart();
  alert("적립금이 적용되었습니다.");
}
async function addPoint(memberData, amount, reason, type="auto"){
  if(!memberData || !amount) return;
  const uid=memberData.uid||memberData.id||memberData.memberUid;
  const email=memberData.email||memberData.memberEmail||"";
  const name=memberData.name||memberData.memberName||"";
  const set=getPointSettings();
  const exp=new Date(); exp.setDate(exp.getDate()+set.expireDays);
  await addDoc(collection(db,"points"),{
    memberUid:uid, memberEmail:email, memberName:name, amount:Number(amount), reason, type,
    expiresAt:exp.toISOString().slice(0,10), status:"active", createdAt:serverTimestamp()
  });
  try{await updateDoc(doc(db,"members",uid),{points:currentPoints()+Number(amount),updatedAt:serverTimestamp()})}catch(e){}
}
function renderPointSummary(){
  const box=$("pointSummaryBox"); if(!box)return;
  if(!member){box.innerHTML="로그인 후 적립금을 확인할 수 있습니다.";return;}
  const set=getPointSettings();
  box.innerHTML=`<h3>보유 적립금</h3><div class="price">${won(currentPoints())}</div><p>최소 사용: ${won(set.minUse)}</p><p>주문 최대 사용률: ${set.maxUseRate}%</p>`;
}


// ===== 5.3 remaining core additions =====
function renderFaqSupport(){
  if($("faqList")) $("faqList").innerHTML=(state.faqs||[]).map(f=>`<article class="card"><h3>${esc(f.question||"질문")}</h3><p>${esc(f.answer||"")}</p></article>`).join("")||"<p>등록된 FAQ가 없습니다.</p>";
  const box=$("mySupportList"); if(!box)return;
  if(!member){box.innerHTML="<p>로그인 후 문의 내역을 확인할 수 있습니다.</p>";return;}
  const uid=member.uid||member.id;
  const rows=(state.supportTickets||[]).filter(t=>t.memberUid===uid||t.memberEmail===member.email);
  box.innerHTML=rows.length?rows.map(t=>`<article class="card"><h3>${esc(t.title||"문의")}</h3><p>${esc(t.body||"")}</p><p>상태: ${esc(t.status||"대기")}</p>${t.answer?`<p>답변: ${esc(t.answer)}</p>`:""}</article>`).join(""):"<p>문의 내역이 없습니다.</p>";
}
async function submitSupport(){
  if(!member)return alert("로그인 후 문의할 수 있습니다.");
  if(!$("supportTitle").value || !$("supportBody").value)return alert("문의 제목과 내용을 입력해 주세요.");
  await addDoc(collection(db,"supportTickets"),{memberUid:member.uid||member.id,memberEmail:member.email,memberName:member.name||"",title:$("supportTitle").value,body:$("supportBody").value,status:"대기",createdAt:serverTimestamp()});
  await addDoc(collection(db,"notifications"),{target:"admin",title:"새 1:1 문의",body:$("supportTitle").value,createdAt:serverTimestamp()});
  alert("문의가 등록되었습니다.");
}
function fillMemberEdit(){
  if(!member)return;
  if($("editName"))$("editName").value=member.name||"";
  if($("editContact"))$("editContact").value=member.contact||"";
  if($("editBirthday"))$("editBirthday").value=member.birthday||"";
}
async function saveMemberEdit(){
  if(!member)return alert("로그인 후 이용해 주세요.");
  const uid=member.uid||member.id||auth.currentUser?.uid;
  const data={name:$("editName").value,contact:$("editContact").value,birthday:$("editBirthday").value,updatedAt:serverTimestamp()};
  await setDoc(doc(db,"members",uid),data,{merge:true});
  member={...member,...data,uid};
  await logMemberActivity("회원정보 수정","개인정보 수정 완료");
  alert("회원정보가 저장되었습니다.");
  renderMember();
  fillMemberEdit();
}
async function requestDeleteMember(){
  if(!member)return;
  if(!confirm("회원탈퇴 요청을 등록할까요?"))return;
  await addDoc(collection(db,"supportTickets"),{memberUid:member.uid||member.id,memberEmail:member.email,memberName:member.name||"",title:"회원탈퇴 요청",body:"회원이 탈퇴를 요청했습니다.",status:"탈퇴요청",createdAt:serverTimestamp()});
  await addDoc(collection(db,"notifications"),{target:"admin",title:"회원탈퇴 요청",body:member.email,createdAt:serverTimestamp()});
  alert("탈퇴 요청이 접수되었습니다.");
}
function productOptionText(p){
  const opt=p.options?`<p>옵션: ${esc(p.options)}</p>`:"";
  const badge=p.badge?`<p class="tag">${esc(p.badge)}</p>`:"";
  const end=p.eventEnd?`<small>행사 종료: ${esc(p.eventEnd)}</small>`:"";
  return badge+opt+end;
}


// ===== 5.4 full requested suite mobile =====
async function logMemberActivity(action, detail=""){
  try{
    if(!member)return;
    await addDoc(collection(db,"activityLogs"),{type:"member",memberUid:member.uid||member.id,memberEmail:member.email,action,detail,createdAt:serverTimestamp()});
  }catch(e){}
}
async function sendVerifyEmail(){
  if(!auth.currentUser)return alert("로그인 후 이용해 주세요.");
  await sendEmailVerification(auth.currentUser);
  alert("이메일 인증 메일을 보냈습니다.");
}
async function sendResetPassword(){
  const email=member?.email||auth.currentUser?.email;
  if(!email)return alert("로그인 후 이용해 주세요.");
  await sendPasswordResetEmail(auth,email);
  alert("비밀번호 재설정 메일을 보냈습니다.");
}
function renderMemberSecurity(){
  const uid=member?.uid||member?.id;
  const box=$("myActivityLogs"); if(!box)return;
  if(!member){box.innerHTML="<p>로그인 후 확인 가능합니다.</p>";return;}
  const rows=(state.activityLogs||[]).filter(l=>l.memberUid===uid||l.memberEmail===member.email).slice(0,30);
  box.innerHTML=rows.length?rows.map(l=>`<article class="card"><h3>${esc(l.action||"활동")}</h3><p>${esc(l.detail||"")}</p><small>${l.createdAt?.seconds?new Date(l.createdAt.seconds*1000).toLocaleString():""}</small></article>`).join(""):"<p>활동 로그가 없습니다.</p>";
}
function renderBookingHistory(){
  const box=$("bookingHistoryList"); if(!box)return;
  if(!member){box.innerHTML="<p>로그인 후 확인 가능합니다.</p>";return;}
  const rows=(state.bookings||[]).filter(b=>b.memberUid===(member.uid||member.id)||b.memberEmail===member.email||b.contact===member.contact);
  box.innerHTML=rows.length?rows.map(b=>`<article class="card"><h3>${esc(b.type||"상담 예약")}</h3><p>${esc(b.date)} ${esc(b.time)}</p><p>상태: ${esc(b.status||"")}</p><button class="secondary" onclick="cancel('bookings','${b.id}')">예약 취소</button></article>`).join(""):"<p>예약 이력이 없습니다.</p>";
}
function renderRefundHistory(){
  const box=$("refundHistoryList"); if(!box)return;
  if(!member){box.innerHTML="<p>로그인 후 확인 가능합니다.</p>";return;}
  const uid=member.uid||member.id;
  const rows=(state.refundLogs||[]).filter(r=>r.memberUid===uid||r.memberEmail===member.email);
  box.innerHTML=rows.length?rows.map(r=>`<article class="card"><h3>${esc(r.title||"환불/취소")}</h3><p>${esc(r.reason||"")}</p><p>상태: ${esc(r.status||"")}</p></article>`).join(""):"<p>환불/취소 이력이 없습니다.</p>";
}
function renderConsultReports(){
  const box=$("myFilesList"); if(!box||!member)return;
  const uid=member.uid||member.id;
  const reports=(state.consultationReports||[]).filter(r=>r.memberUid===uid||r.memberEmail===member.email);
  const html=reports.map(r=>`<article class="card"><h3>${esc(r.title||"상담 완료 보고서")}</h3><p>${esc(r.result||"")}</p>${(r.urls||[]).map((u,i)=>`<a class="secondary fileLink" target="_blank" href="${u}">첨부 ${i+1}</a>`).join("")}</article>`).join("");
  if(html) box.innerHTML=html+box.innerHTML;
}


// ===== 6.0 enterprise mobile additions =====
let deferredInstallPrompt=null;
window.addEventListener("beforeinstallprompt",(e)=>{e.preventDefault();deferredInstallPrompt=e;});
async function trackVisitor(){
  try{
    const id=localStorage.cyVisitorId || ("v_"+Math.random().toString(36).slice(2));
    localStorage.cyVisitorId=id;
    await setDoc(doc(db,"visitorSessions",id),{
      id, path:location.pathname, referrer:document.referrer||"", userAgent:navigator.userAgent,
      device:/Mobi|Android|iPhone/i.test(navigator.userAgent)?"mobile":"pc",
      lang:navigator.language||"", lastSeenAt:serverTimestamp(), createdDate:new Date().toISOString().slice(0,10)
    },{merge:true});
  }catch(e){}
}
function toggleTheme(){
  document.body.classList.toggle("lightMode");
  localStorage.cyTheme=document.body.classList.contains("lightMode")?"light":"dark";
}
function initTheme(){
  if(localStorage.cyTheme==="light")document.body.classList.add("lightMode");
}
async function installPwa(){
  if(deferredInstallPrompt){deferredInstallPrompt.prompt(); return;}
  openInstallGuide();
}
function globalSearch(){
  const q=($("globalSearchInput")?.value||"").toLowerCase();
  const box=$("globalSearchResults"); if(!box)return;
  if(!q){box.innerHTML="<p>검색어를 입력하세요.</p>";return;}
  const rows=[
    ...state.products.map(x=>({type:"상품",title:x.name,body:x.desc})),
    ...state.reviews.map(x=>({type:"후기",title:x.name,body:x.body})),
    ...state.notices.map(x=>({type:"공지",title:x.title,body:x.body})),
    ...state.bookings.map(x=>({type:"상담",title:x.type,body:x.body})),
    ...state.supportTickets.map(x=>({type:"문의",title:x.title,body:x.body}))
  ].filter(x=>`${x.type} ${x.title} ${x.body}`.toLowerCase().includes(q));
  box.innerHTML=rows.slice(0,30).map(r=>`<article class="card"><h3>[${r.type}] ${esc(r.title||"")}</h3><p>${esc(r.body||"")}</p></article>`).join("")||"<p>검색 결과가 없습니다.</p>";
}
function makeQr(text, boxId){
  const box=$(boxId); if(!box)return;
  const url="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data="+encodeURIComponent(text);
  box.innerHTML=`<img class="qrImg" src="${url}"><p>${esc(text)}</p>`;
}
async function checkin(){
  if(!member)return alert("로그인 후 참여해 주세요.");
  const today=new Date().toISOString().slice(0,10);
  const exists=(state.points||[]).some(p=>p.memberUid===(member.uid||member.id)&&p.type==="checkin"&&p.date===today);
  if(exists)return alert("오늘은 이미 출석체크를 했습니다.");
  const setting=(state.eventGameSettings||[])[0]||{checkinPoint:100};
  await addDoc(collection(db,"points"),{memberUid:member.uid||member.id,memberEmail:member.email,memberName:member.name||"",amount:Number(setting.checkinPoint||100),reason:"출석체크 적립",type:"checkin",date:today,status:"active",createdAt:serverTimestamp()});
  $("eventPlayResult").innerHTML=`<div class="card">출석 완료! ${won(Number(setting.checkinPoint||100))} 적립</div>`;
}
async function roulette(){
  if(!member)return alert("로그인 후 참여해 주세요.");
  const setting=(state.eventGameSettings||[])[0]||{prizes:"1000P,500P,꽝"};
  const prizes=String(setting.prizes||"1000P,500P,꽝").split(",").map(x=>x.trim()).filter(Boolean);
  const prize=prizes[Math.floor(Math.random()*prizes.length)]||"꽝";
  if(/P|포인트|원/.test(prize)){
    const amt=Number(prize.replace(/[^\d]/g,""))||0;
    if(amt>0)await addDoc(collection(db,"points"),{memberUid:member.uid||member.id,memberEmail:member.email,memberName:member.name||"",amount:amt,reason:"룰렛 이벤트",type:"roulette",status:"active",createdAt:serverTimestamp()});
  }
  $("eventPlayResult").innerHTML=`<div class="card">룰렛 결과: <b>${esc(prize)}</b></div>`;
}
window.addEventListener("error",async(e)=>{try{await addDoc(collection(db,"errorLogs"),{message:e.message,source:e.filename,line:e.lineno,createdAt:serverTimestamp()})}catch(_){}});


// ===== 6.1 full image visible additions =====
function openFullImage(src){
  if(!src)return;
  let viewer=document.getElementById("imageViewer");
  if(!viewer){
    viewer=document.createElement("div");
    viewer.id="imageViewer";
    viewer.innerHTML=`<button id="imageViewerClose" type="button">닫기</button><img id="imageViewerImg" alt="전체 이미지">`;
    document.body.appendChild(viewer);
    document.getElementById("imageViewerClose").onclick=()=>viewer.classList.remove("show");
    viewer.onclick=(e)=>{if(e.target===viewer)viewer.classList.remove("show")};
  }
  document.getElementById("imageViewerImg").src=src;
  viewer.classList.add("show");
}
window.openFullImage=openFullImage;


// ===== 6.2 install guide / profile fix =====
function openInstallGuide(){
  const m=document.getElementById("installGuideModal");
  if(m)m.classList.add("show");
}
function closeInstallGuide(){
  const m=document.getElementById("installGuideModal");
  if(m)m.classList.remove("show");
}


// ===== 6.3 member realtime sync fix =====
async function ensureMemberSynced(u){
  try{
    if(!u)return;
    const uid=u.uid || u.id || auth.currentUser?.uid;
    const email=u.email || auth.currentUser?.email || "";
    const base={
      uid,
      email,
      name:member?.name || u.displayName || "",
      contact:member?.contact || "",
      lastLoginAt:serverTimestamp(),
      updatedAt:serverTimestamp()
    };
    await setDoc(doc(db,"members",uid),base,{merge:true});
    await setDoc(doc(db,"users",uid),base,{merge:true});
    await addDoc(collection(db,"activityLogs"),{type:"member",memberUid:uid,memberEmail:email,action:"접속/동기화",detail:"회원 정보 자동 동기화",createdAt:serverTimestamp()}).catch(()=>{});
  }catch(e){console.warn("member sync failed",e)}
}


// ===== 6.4 최고관리자 등급 표시 수정 =====
function adminRoleLabel(role){
  const map={super:"최고관리자",operation:"운영관리자",consult:"상담관리자",delivery:"배송관리자",customer:"고객관리자",admin:"관리자",staff:"직원"};
  return map[role]||role||"";
}
function getMyVisibleGrade(){
  if(!member) return "일반";
  const email=String(member.email||auth.currentUser?.email||"").toLowerCase();
  const role=(state.adminRoles||[]).find(r=>String(r.email||"").toLowerCase()===email);
  if(role) return adminRoleLabel(role.role);
  return member.grade || member.vipStatus || "일반";
}


// ===== 6.5 sync badge disable =====
function hideSyncBadges(){
  document.querySelectorAll(".syncStatus,#syncStatus,.realtimeBadge,.liveSyncBadge,[data-sync-status]").forEach(el=>{
    el.style.display="none";
    el.style.visibility="hidden";
    el.style.opacity="0";
    el.style.position="static";
  });
}
setInterval(hideSyncBadges,800);
window.addEventListener("load",hideSyncBadges);


// ===== 7.0 total platform automation mobile =====
function renderMyTotalStatus(){
  const box=$("myTotalStatus"); if(!box)return;
  if(!member){box.innerHTML="<p>로그인 후 확인 가능합니다.</p>";return;}
  const uid=member.uid||member.id;
  const orders=state.orders.filter(o=>o.memberUid===uid||o.memberEmail===member.email);
  const bookings=state.bookings.filter(b=>b.memberUid===uid||b.memberEmail===member.email);
  const coupons=state.coupons.filter(c=>c.memberUid===uid||c.memberEmail===member.email);
  const points=currentPoints?currentPoints():0;
  const reports=(state.consultationReports||[]).filter(r=>r.memberUid===uid||r.memberEmail===member.email);
  box.innerHTML=[
    `<article class="card"><h3>주문</h3><p>${orders.length}건</p></article>`,
    `<article class="card"><h3>예약/상담</h3><p>${bookings.length}건</p></article>`,
    `<article class="card"><h3>쿠폰</h3><p>${coupons.length}개</p></article>`,
    `<article class="card"><h3>적립금</h3><p>${won(points)}</p></article>`,
    `<article class="card"><h3>상담보고서</h3><p>${reports.length}개</p></article>`
  ].join("");
}
async function issueMarketingCoupon(kind){
  if(!member)return alert("로그인 후 이용해 주세요.");
  const s=(state.marketingSettings||[])[0]||{};
  const map={birthday:Number(s.birthdayCouponAmount||3000),first:Number(s.firstBuyCouponAmount||5000)};
  const code=(kind==="birthday"?"BIRTH":"FIRST")+"-"+Math.random().toString(36).slice(2,7).toUpperCase();
  await addDoc(collection(db,"coupons"),{code,discount:String(map[kind]||1000),desc:kind==="birthday"?"생일쿠폰":"첫구매쿠폰",memberUid:member.uid||member.id,memberEmail:member.email,used:false,createdAt:serverTimestamp()});
  $("marketingResult").innerHTML=`<article class="card"><h3>쿠폰 발급</h3><p>${code}</p></article>`;
}
async function referralReward(){
  if(!member)return alert("로그인 후 이용해 주세요.");
  $("marketingResult").innerHTML=`<article class="card"><h3>내 추천 코드</h3><p>${referralCode()}</p><p>친구가 가입 시 입력하면 보상이 지급됩니다.</p></article>`;
}


// ===== 7.3 payment layout safety =====
function fixPaymentLayout(){
  document.querySelectorAll("button").forEach(btn=>{
    const txt=(btn.textContent||"").trim();
    if(txt.includes("카카오페이 송금") || txt.includes("번호 복사") || txt.includes("계좌번호 복사")){
      btn.style.position="static";
      btn.style.width="100%";
      btn.style.marginTop="12px";
      btn.style.display="block";
    }
    if(txt === "카카오페이 번호 복사" || txt === "계좌/번호 복사"){
      btn.textContent = txt.includes("계좌") ? "계좌번호 복사" : "카카오페이 번호 복사";
    }
  });
}
setInterval(fixPaymentLayout,1000);
window.addEventListener("load",fixPaymentLayout);


// ===== 7.4 premium UI dedupe/profile restore =====
function premiumDedupeHome(){
  const home=document.getElementById("home");
  if(!home)return;
  const premium=home.querySelector(".premiumHero");
  if(premium){
    [...home.children].forEach(el=>{
      if(el===premium || el.classList.contains("premiumProfileSection") || el.classList.contains("premiumSection")) return;
      const txt=(el.textContent||"");
      if(txt.includes("17년차 황해도 이북 만신") && txt.includes("천율도령 공식 신점 상담")){
        el.style.display="none";
      }
      if(txt.includes("상담 예약하기") && txt.includes("상품 구매하기") && !el.classList.contains("premiumHero")){
        el.style.display="none";
      }
    });
  }
  // 하단 메뉴 중복 텍스트/과다 버튼 정리
  const nav=document.querySelector(".bottomNav");
  if(nav){
    const keep=["홈","통합","검색","예약","상품","후기","혜택","문의","마이"];
    [...nav.querySelectorAll("button")].forEach(btn=>{
      const t=(btn.textContent||"").trim();
      if(!keep.some(k=>t.includes(k))) btn.classList.add("navMoreHidden");
    });
  }
}
setInterval(premiumDedupeHome,1000);
window.addEventListener("load",premiumDedupeHome);


// ===== 8.0 customer all-in-one additions =====
function levelFromExp(exp){return Math.max(1,Math.floor(Number(exp||0)/1000)+1)}
function gradeIcon(g){return g==="VVIP"?"👑":g==="VIP"?"💎":g==="GOLD"?"🏆":g==="SILVER"?"🥈":"🌙"}
async function savePremiumProfile(){
  if(!member)return alert("로그인 후 이용해 주세요.");
  let photo="";
  const f=$("profilePhotoInput")?.files?.[0];
  if(f){
    const r=ref(storage,`profiles/${member.uid||member.id}_${Date.now()}_${f.name}`);
    await uploadBytes(r,f); photo=await getDownloadURL(r);
  }
  const data={nickname:val("profileNickname"),photoUrl:photo||member.photoUrl||"",updatedAt:serverTimestamp()};
  await setDoc(doc(db,"members",member.uid||member.id),data,{merge:true});
  alert("프로필이 저장되었습니다.");
}
function renderPremiumProfile(){
  const box=$("premiumMyProfile"); if(!box)return;
  if(!member){box.innerHTML="<p>로그인 후 확인 가능합니다.</p>";return;}
  const g=getMyVisibleGrade?getMyVisibleGrade():(member.grade||"일반");
  const exp=Number(member.exp||0), lv=levelFromExp(exp);
  box.innerHTML=`<article class="premiumMemberCard">${member.photoUrl?`<img src="${member.photoUrl}" class="avatarLg">`:`<div class="avatarLg">${gradeIcon(g)}</div>`}<h3>${esc(member.nickname||member.name||"회원님")}</h3><p>${gradeIcon(g)} ${esc(g)} · Lv.${lv}</p><p>경험치 ${exp.toLocaleString()} EXP</p><p>활동배지: 출석 · 상담 · 구매 · 후기</p></article>`;
}
function renderCommercePlus(){
  const recent=$("recentProductList"), wish=$("wishlistProductList"), reco=$("recommendProductList");
  const uid=member?.uid||member?.id;
  if(recent){
    const rows=(state.recentViews||[]).filter(x=>x.memberUid===uid).slice(0,12);
    recent.innerHTML=rows.length?rows.map(x=>`<article class="card"><h3>${esc(x.name||"상품")}</h3><p>최근 본 상품</p></article>`).join(""):"<p>최근 본 상품이 없습니다.</p>";
  }
  if(wish){
    const rows=(state.wishlists||[]).filter(x=>x.memberUid===uid).slice(0,12);
    wish.innerHTML=rows.length?rows.map(x=>`<article class="card"><h3>${esc(x.name||"관심상품")}</h3><p>찜한 상품</p></article>`).join(""):"<p>관심상품이 없습니다.</p>";
  }
  if(reco){
    const rows=(state.products||[]).filter(p=>p.badge==="추천"||p.flag==="추천상품"||p.best).slice(0,8);
    reco.innerHTML=rows.length?rows.map(p=>`<article class="card">${imgTag(p.image||p.img||"")}<h3>${esc(p.name||"상품")}</h3><p>${esc(p.desc||"")}</p></article>`).join(""):"<p>추천상품이 없습니다.</p>";
  }
}
function renderConsultLounge(){
  const progress=$("consultProgressBox"), queue=$("consultQueueBox");
  if(!member){if(progress)progress.innerHTML="<p>로그인 후 확인 가능합니다.</p>";return;}
  const uid=member.uid||member.id;
  const bookings=state.bookings.filter(b=>b.memberUid===uid||b.memberEmail===member.email);
  if(progress)progress.innerHTML=bookings.map(b=>{
    const op=(state.consultOps||[]).find(o=>o.bookingId===b.id)||{};
    return `<article class="card"><h3>${esc(b.type||"상담")}</h3><p>상태: ${esc(b.status||"대기")}</p><p>진행률: ${esc(op.progress||"0")}%</p><p>상담시간: ${esc(op.duration||"-")}분</p></article>`;
  }).join("")||"<p>상담 진행 내역이 없습니다.</p>";
  if(queue)queue.innerHTML=`<article class="card"><h3>상담 대기열</h3><p>현재 예약 ${bookings.length}건</p></article>`;
}
function renderVipBenefits(){
  const box=$("vipBenefitList"); if(!box)return;
  const s=(state.memberGrowthSettings||[])[0]||{};
  box.innerHTML=`<article class="card"><h3>VIP 전용혜택</h3><p>${esc(s.vipBenefit||"VIP 회원에게는 우선 상담, 전용 쿠폰, 특별 적립 혜택이 제공됩니다.")}</p></article>`;
}


// ===== 8.1 안정화/버그정리 최종 =====
function stableCleanup(){
  try{
    document.querySelectorAll(".syncStatus,#syncStatus,.realtimeBadge,.liveSyncBadge,[data-sync-status]").forEach(el=>el.remove());
    // 홈 중복 히어로 제거
    const home=document.getElementById("home");
    if(home){
      let premium=home.querySelector(".premiumHero");
      [...home.children].forEach(el=>{
        if(el===premium || el.classList.contains("premiumProfileSection") || el.classList.contains("premiumSection")) return;
        const txt=(el.textContent||"");
        if(txt.includes("천율도령 공식 신점 상담") && txt.includes("상담 예약하기")) el.style.display="none";
        if(txt.includes("17년차 황해도 이북 만신") && txt.includes("상품 구매하기")) el.style.display="none";
      });
    }
    // 하단 메뉴 핵심만
    const nav=document.querySelector(".bottomNav");
    if(nav){
      const allow=["홈","예약","상품","후기","문의","마이","프로필"];
      [...nav.querySelectorAll("button")].forEach(btn=>{
        const t=(btn.textContent||"").trim();
        if(!allow.some(a=>t.includes(a))) btn.style.display="none";
      });
    }
  }catch(e){}
}
async function stableEnsureMember(){
  try{
    if(!auth.currentUser) return;
    const uid=auth.currentUser.uid, email=auth.currentUser.email||"";
    const data={
      uid,email,
      name:member?.name||auth.currentUser.displayName||"",
      contact:member?.contact||"",
      lastLoginAt:serverTimestamp(),
      updatedAt:serverTimestamp(),
      status:member?.status||"정상"
    };
    await setDoc(doc(db,"members",uid),data,{merge:true});
    await setDoc(doc(db,"users",uid),data,{merge:true});
  }catch(e){console.warn("stable member sync",e)}
}
setInterval(stableCleanup,1000);
window.addEventListener("load",()=>{stableCleanup(); setTimeout(stableEnsureMember,1000);});


// ===== 8.2 결제 안내 카드형 정리 / 신점 10만원 =====
function premiumPaymentCardsHTML(){
  return `
  <section class="payPremiumWrap">
    <h2>💳 결제 안내</h2>
    <article class="payPremiumCard intro">
      <h3>📌 예약제 상담</h3>
      <p>모든 상담은 <b>선결제 예약제</b>로 진행됩니다.<br>결제 확인 후 예약 순서에 따라 상담을 진행해 드립니다.</p>
    </article>

    <article class="payPremiumCard">
      <h3>💰 상담 비용</h3>
      <div class="priceRows">
        <div><span>❤️ 한 질문 상담</span><b>20,000원</b></div>
        <div><span>❤️ 세 질문 상담</span><b>50,000원</b></div>
        <div><span>💞 궁합 상담</span><b>80,000원</b></div>
        <div><span>🔮 신점 상담</span><b>100,000원</b></div>
      </div>
    </article>

    <article class="payPremiumCard">
      <h3>💳 카카오페이</h3>
      <p class="payNumber">020-02-407816</p>
      <button class="primary" type="button" onclick="location.href='https://qr.kakaopay.com/281006011000002710315576'">카카오페이 송금하기</button>
      <button class="secondary" type="button" onclick="navigator.clipboard.writeText('020-02-407816').then(()=>alert('카카오페이 번호가 복사되었습니다.'))">카카오페이 번호 복사</button>
    </article>

    <article class="payPremiumCard">
      <h3>🏦 계좌이체</h3>
      <p class="bankName">농협 3521566284653</p>
      <p>예금주 <b>정세진</b></p>
      <button class="primary" type="button" onclick="navigator.clipboard.writeText('3521566284653').then(()=>alert('계좌번호가 복사되었습니다.'))">계좌번호 복사</button>
    </article>

    <article class="payPremiumCard">
      <h3>📩 입금 후 보내주세요</h3>
      <ul>
        <li>성함 또는 닉네임</li>
        <li>입금자명</li>
        <li>상담 내용 또는 예약 시간</li>
      </ul>
      <p>입금 확인 후 순차적으로 상담을 진행해 드립니다.</p>
    </article>

    <article class="payPremiumCard notice">
      <h3>📢 안내사항</h3>
      <ul>
        <li>상담은 결제 완료 순서대로 진행됩니다.</li>
        <li>상담 시작 후에는 취소 및 환불이 어려울 수 있습니다.</li>
        <li>예약 시간 변경이 필요한 경우 미리 연락 부탁드립니다.</li>
        <li>질문을 미리 정리해 주시면 더욱 정확한 상담이 가능합니다.</li>
      </ul>
    </article>

    <article class="payPremiumCard thanks">
      <h3>🌙 천명신당 │ 천율도령</h3>
      <p>감사합니다.</p>
    </article>
  </section>`;
}
function replacePaymentGuideWithCards(){
  try{
    const candidates=[...document.querySelectorAll(".card,.formCard,section,article,div")].filter(el=>{
      const t=el.textContent||"";
      return t.includes("결제 안내") && (t.includes("카카오페이") || t.includes("계좌이체")) && t.includes("상담 비용");
    });
    candidates.forEach(el=>{
      if(el.classList.contains("payPremiumWrap") || el.querySelector(".payPremiumWrap")) return;
      if((el.textContent||"").length > 120){
        el.innerHTML = premiumPaymentCardsHTML();
        el.classList.add("paymentCardsApplied");
      }
    });
  }catch(e){}
}
setInterval(replacePaymentGuideWithCards,1200);
window.addEventListener("load",replacePaymentGuideWithCards);


// ===== 8.3 홈 메인 문구 정리 + CTA 연결 수정 =====
function fixPremiumHeroTextAndLinks(){
  try{
    const hero=document.querySelector(".premiumHero");
    if(hero){
      const eyebrow=hero.querySelector(".premiumEyebrow");
      if(eyebrow) eyebrow.textContent="CHEONYUL DORYEONG OFFICIAL";
      const h1=hero.querySelector("h1");
      if(h1) h1.innerHTML="천명신당<br><span>천율도령</span>";
      const lead=hero.querySelector(".premiumLead");
      if(lead) lead.innerHTML="17년차 황해도 이북 만신이 전하는<br>신점 · 신타로 · 부적 · 초발원 상담";
      const trust=hero.querySelector(".premiumTrust");
      if(trust) trust.innerHTML="<span>1:1 비밀상담</span><span>예약제 상담</span><span>회원 쿠폰/적립금</span>";
    }
    document.querySelectorAll("button,a").forEach(el=>{
      const t=(el.textContent||"").trim();
      if(t==="상담 예약하기" || t==="예약"){
        el.onclick=(e)=>{e.preventDefault(); go("booking");};
        el.setAttribute("data-go","booking");
      }
      if(t==="상품 보기" || t==="상품 구매하기" || t==="상품"){
        if(t==="상품 구매하기") el.textContent="상품 보기";
        el.onclick=(e)=>{e.preventDefault(); go("products");};
        el.setAttribute("data-go","products");
      }
    });
  }catch(e){}
}
setInterval(fixPremiumHeroTextAndLinks,1000);
window.addEventListener("load",fixPremiumHeroTextAndLinks);


// ===== 8.4 프로필 이미지 복원 + 카카오페이 QR 링크 수정 =====
const CHEONYUL_PROFILE_IMAGE = "./assets/cheonyul_profile.png";
const KAKAO_PAY_QR_LINK = "https://qr.kakaopay.com/281006011000002710315576";

function openKakaoPayQR(){
  location.href = KAKAO_PAY_QR_LINK;
}

function fixProfileAndKakaoPay(){
  try{
    const hero=document.querySelector(".premiumHero");
    if(hero && !hero.querySelector(".homeProfileImage")){
      const img=document.createElement("img");
      img.src=CHEONYUL_PROFILE_IMAGE;
      img.alt="천율도령 프로필";
      img.className="homeProfileImage";
      const eyebrow=hero.querySelector(".premiumEyebrow");
      if(eyebrow) eyebrow.insertAdjacentElement("beforebegin", img);
      else hero.prepend(img);
    }

    document.querySelectorAll(".profileSeal").forEach(el=>{
      if(!el.querySelector("img")){
        el.innerHTML = `<img src="${CHEONYUL_PROFILE_IMAGE}" alt="천율도령 프로필">`;
        el.classList.add("profileSealImage");
      }
    });

    document.querySelectorAll("button,a").forEach(el=>{
      const t=(el.textContent||"").trim();
      if(t.includes("카카오페이 송금")){
        el.onclick=(e)=>{ e.preventDefault(); openKakaoPayQR(); };
        if(el.tagName==="A") {
          el.href=KAKAO_PAY_QR_LINK;
          el.target="_blank";
          el.rel="noopener noreferrer";
        }
      }
    });
  }catch(e){}
}

setInterval(fixProfileAndKakaoPay,1000);
window.addEventListener("load",fixProfileAndKakaoPay);

const defaults={
  prices:[{title:"한 질문 상담",price:"20,000원",desc:"핵심 질문"},{title:"세 질문 상담",price:"50,000원",desc:"세 가지 질문"},{title:"궁합 상담",price:"80,000원",desc:"궁합 흐름"},{title:"신점 상담",price:"100,000원",desc:"심층 상담"}],
  notices:[{title:"상담은 예약제로 진행됩니다.",body:"입금 확인 후 순차적으로 안내됩니다."}]
};

function setSync(t,ok=true){const el=$("syncStatus"); if(el){el.textContent=t; el.className=ok?"syncStatus ok":"syncStatus bad";}}
async function once(col){const s=await getDocs(collection(db,col)); return s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));}
function listen(col,key){onSnapshot(collection(db,col),snap=>{state[key]=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)); hydrate(); renderAll(); setSync("실시간 연동중",true);},e=>{console.error(e); setSync("연동 오류",false);});}
function hydrate(){
  state.prices = state.prices.length ? state.prices : defaults.prices;
  state.notices = state.notices.length ? state.notices : defaults.notices;
  const pay=state.settings.find(s=>s.id==="payment"); if(pay) state.payment=pay;
  const time=state.settings.find(s=>s.id==="bookingTimes"); if(time) state.booking={times:time.times||state.booking.times,blockedDates:time.blockedDates||[]};
}
function go(id){document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));$(id)?.classList.add("active");document.querySelectorAll(".bottomNav button").forEach(b=>b.classList.toggle("on",b.dataset.go===id));window.scrollTo(0,0); renderAll();}
function open(id){$(id)?.classList.add("show");document.body.classList.add("modalOpen")}
function close(id){$(id)?.classList.remove("show");if(!document.querySelector(".modal.show"))document.body.classList.remove("modalOpen")}
function subtotal(){return cart.reduce((s,i)=>s+money(i.price)*i.qty,0)}
function total(){return Math.max(0,subtotal()-couponDiscount-pointUseAmount)}
function saveCart(){localStorage.cyMobileCart=JSON.stringify(cart); if($("cartCount"))$("cartCount").textContent=cart.reduce((s,i)=>s+i.qty,0)}
function imgTag(src){return src?`<div class="productImageWrap"><img class="productImg" src="${src}" loading="lazy" onclick="openFullImage && openFullImage(src)"></div>`:""}

function renderAll(){
  renderHome();
  renderProducts();
  renderBooking();
  renderReviews();
  renderBenefits();
  renderMember();
  renderBusiness();
  renderConsultRecords();
  renderNotifications();
  renderProgressCenter();
  renderReferral();
  renderPointHistory();
  renderPointSummary();
  renderFaqSupport();
  renderPremiumProfile();
  renderCommercePlus();
  renderConsultLounge();
  renderVipBenefits();
  renderMyTotalStatus();
  renderMemberSecurity();
  renderBookingHistory();
  renderRefundHistory();
  renderConsultReports();
  fillMemberEdit();
  renderEvents();
  renderChat();
  renderMemberFiles();
  renderReceipts();
  renderMyEpost();
  applySeo();
  saveCart();
}
function renderHome(){
  if($("priceList")) $("priceList").innerHTML=state.prices.map(p=>`<article class="card"><h3>${esc(p.title)}</h3><p>${esc(p.desc)}</p><div class="price">${esc(p.price)}</div><button class="primary addConsult" data-name="${esc(p.title)}" data-price="${esc(p.price)}">상담 담기</button></article>`).join("");
  document.querySelectorAll(".addConsult").forEach(b=>b.onclick=()=>addCart({id:"consult-"+b.dataset.name,name:b.dataset.name,price:b.dataset.price,qty:1,type:"consult"}));
  if($("noticeList")) $("noticeList").innerHTML=state.notices.map(n=>`<article class="card"><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p></article>`).join("");
  if($("homeBannerList")) $("homeBannerList").innerHTML=state.banners.length?state.banners.slice(0,3).map(b=>`<article class="card highlightCard"><h3>${esc(b.title||"공지")}</h3><p>${esc(b.body||"")}</p></article>`).join(""):`<article class="card"><h3>천율도령 공식 안내</h3><p>관리자 홈관리에서 배너를 등록하면 즉시 표시됩니다.</p></article>`;
  if($("homeBenefitList")) $("homeBenefitList").innerHTML=state.benefits.length?state.benefits.slice(0,3).map(b=>`<article class="card benefitCard"><h3>${esc(b.title||"회원 혜택")}</h3><p>${esc(b.body||"")}</p></article>`).join(""):`<article class="card"><h3>회원 전용 혜택</h3><p>로그인 후 쿠폰과 적립금을 확인하세요.</p></article>`;
  if($("paymentSummaryHome")) $("paymentSummaryHome").innerHTML=`<article class="card"><h3>카카오페이 / 계좌이체</h3><p>${esc(state.payment.guide||"송금 후 주문 신청")}</p><p>카카오페이: ${esc(state.payment.account||"등록 전")}</p>${state.payment.bankAccount?`<p>계좌: ${esc(state.payment.bankName)} ${esc(state.payment.bankAccount)}</p>`:""}</article>`;
}
function renderProducts(){
  const q=($("search")?.value||"").toLowerCase();
  const rows=state.products.filter(p=>!q||`${p.name} ${p.desc} ${p.category}`.toLowerCase().includes(q));
  if($("productList")) $("productList").innerHTML=rows.map(p=>`<article class="card">${imgTag(p.images?.[0])}<h3>${esc(p.name)}</h3><p>${esc(p.desc)}</p><div class="price">${esc(p.sale||p.price)}</div><button class="primary addProduct" data-id="${p.id}">담기</button><button class="secondary favProduct" data-id="${p.id}">즐겨찾기</button></article>`).join("")||"<p>등록된 상품이 없습니다.</p>";
  document.querySelectorAll(".addProduct").forEach(b=>b.onclick=()=>{let p=state.products.find(x=>x.id===b.dataset.id); if(p){addRecent(p); addCart({id:p.id,name:p.name,price:p.sale||p.price,qty:1,type:"product"});}});
  document.querySelectorAll(".favProduct").forEach(b=>b.onclick=()=>{let p=state.products.find(x=>x.id===b.dataset.id); toggleFav(p);});
}
function renderBooking(){
  if($("bookType")) $("bookType").innerHTML=state.prices.map(p=>`<option>${esc(p.title)} ${esc(p.price)}</option>`).join("");
  renderTimes();
}
function renderReviews(){
  const reviews=state.reviews.filter(r=>r.approved);
  if($("reviewList")) $("reviewList").innerHTML=reviews.map(r=>`<article class="card"><h3>${esc(r.stars)} ${esc(r.name)}</h3><p>${esc(r.body)}</p></article>`).join("")||"<p>승인된 후기가 없습니다.</p>";
}
function renderBenefits(){
  if($("memberGradeBox")) $("memberGradeBox").innerHTML=member?`<h3>${esc(member.name||"회원")}님</h3><p>회원등급: <b>${grade()}</b></p><p>이메일: ${esc(member.email||"")}</p>`:`<p>로그인 후 회원 등급을 확인할 수 있습니다.</p>`;
  if($("pointBox")) $("pointBox").innerHTML=`<div class="card"><h3>보유 적립금</h3><div class="price">${won(Number(member?.points||0))}</div></div>`;
  if($("favoriteList")) $("favoriteList").innerHTML=favorites.length?favorites.map(p=>`<article class="card">${imgTag(p.image)}<h3>${esc(p.name)}</h3><p>${esc(p.price)}</p></article>`).join(""):"<p>즐겨찾기한 상품이 없습니다.</p>";
  if($("recentList")) $("recentList").innerHTML=recentViewed.length?recentViewed.map(p=>`<article class="card">${imgTag(p.image)}<h3>${esc(p.name)}</h3><p>${esc(p.price)}</p></article>`).join(""):"<p>최근 본 상품이 없습니다.</p>";
}
function grade(){const pts=Number(member?.points||0); if(pts>=100000)return"VIP"; if(pts>=50000)return"GOLD"; if(pts>=10000)return"SILVER"; return"일반";}
function addRecent(p){recentViewed=recentViewed.filter(x=>x.id!==p.id);recentViewed.unshift({id:p.id,name:p.name,price:p.sale||p.price,image:p.images?.[0]||""});recentViewed=recentViewed.slice(0,10);localStorage.cyRecentViewed=JSON.stringify(recentViewed)}
function toggleFav(p){if(!p)return;const e=favorites.find(x=>x.id===p.id);favorites=e?favorites.filter(x=>x.id!==p.id):[{id:p.id,name:p.name,price:p.sale||p.price,image:p.images?.[0]||""},...favorites];localStorage.cyFavorites=JSON.stringify(favorites);alert("즐겨찾기에 반영되었습니다.");renderBenefits();}
function addCart(i){let f=cart.find(x=>x.id===i.id);f?f.qty++:cart.push(i);saveCart();alert("담았습니다.")}
function renderCart(){
  if($("cartItems")) $("cartItems").innerHTML=cart.map((i,k)=>`<div class="cartItem"><div><b>${esc(i.name)}</b><br>${esc(i.price)} × ${i.qty}</div><button class="remove" data-i="${k}">삭제</button></div>`).join("")||"<p>장바구니가 비어 있습니다.</p>";
  document.querySelectorAll(".remove").forEach(b=>b.onclick=()=>{cart.splice(+b.dataset.i,1);saveCart();renderCart()});
  if($("subtotal"))$("subtotal").textContent=won(subtotal());
  if($("discount"))$("discount").textContent=won(couponDiscount);
  if($("total"))$("total").textContent=won(total());
  if($("couponText"))$("couponText").textContent=coupon?`${coupon.code} / ${won(couponDiscount)} 할인`:"적용된 쿠폰이 없습니다.";
  if($("pointUseText"))$("pointUseText").textContent=pointUseAmount?`${won(pointUseAmount)} 사용`:"사용한 적립금이 없습니다.";
}
function renderPay(){
  const p=state.payment;
  if($("payInfo")) $("payInfo").innerHTML=`<div class="payCard"><b>카카오페이</b><div class="payNum">${esc(p.account||"02002407816")}</div>${p.link?`<a class="primary" target="_blank" href="${p.link}">카카오페이 송금하기</a>`:""}<button class="copy" data-copy="${esc(p.account||"02002407816")}">카카오페이 번호 복사</button></div>${p.bankAccount?`<div class="payCard"><b>계좌이체</b><div class="payNum">${esc(p.bankName)} ${esc(p.bankAccount)}</div><p>예금주: ${esc(p.bankOwner)}</p><button class="copy" data-copy="${esc(p.bankAccount)}">계좌번호 복사</button></div>`:""}<p>${esc(p.guide||"송금 후 주문 신청")}</p>`;
  document.querySelectorAll(".copy").forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.copy)}catch(e){const t=document.createElement("textarea");t.value=b.dataset.copy;document.body.appendChild(t);t.select();document.execCommand("copy");t.remove()}alert("복사되었습니다.")});
}
async function applyCoupon(){
  const code=($("couponInput")?.value||"").trim().toUpperCase(); if(!code)return alert("쿠폰 코드를 입력하세요.");
  const c=state.coupons.find(x=>(x.code||"").toUpperCase()===code); if(!c)return alert("등록되지 않은 쿠폰입니다."); if(c.used)return alert("이미 사용된 쿠폰입니다.");
  if(c.memberUid||c.memberEmail){if(!member)return alert("회원 전용 쿠폰입니다."); if(c.memberUid&&c.memberUid!==(member.uid||member.id))return alert("해당 회원 쿠폰입니다."); if(c.memberEmail&&c.memberEmail!==member.email)return alert("해당 회원 쿠폰입니다.");}
  coupon=c; couponDiscount=money(c.discount); renderCart(); alert("쿠폰 적용 완료");
}
function orderNo(){return"CY"+new Date().toISOString().slice(2,10).replaceAll("-","")+"-"+Math.random().toString(36).slice(2,7).toUpperCase()}
async function order(){
  if(!cart.length)return alert("장바구니가 비었습니다.");
  if(!$("orderName").value||!$("orderContact").value)return alert("이름과 연락처를 입력하세요.");
  const no=orderNo();
  await addDoc(collection(db,"orders"),{orderNo:no,items:cart,subtotal:won(subtotal()),discount:couponDiscount,coupon:coupon?.code||"",pointUsed:pointUseAmount,total:won(total()),name:$("orderName").value,contact:$("orderContact").value,address:$("orderAddress").value,memo:$("orderMemo").value,memberUid:member?.uid||member?.id||"",memberEmail:member?.email||"",status:"입금대기",createdAt:serverTimestamp()});
  await decreaseStockAfterOrder();
  await addDoc(collection(db,"notifications"),{target:"admin",title:"새 주문 접수",body:`${$("orderName").value} / ${won(total())}`,createdAt:serverTimestamp()});
  await addDoc(collection(db,"notifications"),{memberUid:member?.uid||member?.id||"",memberEmail:member?.email||"",title:"주문 접수 알림",body:`주문번호 ${no} 접수 완료`,createdAt:serverTimestamp()});
  if(coupon?.id)try{await updateDoc(doc(db,"coupons",coupon.id),{used:true,usedAt:serverTimestamp(),usedCount:Number(coupon.usedCount||0)+1})}catch(e){}
  if(member && pointUseAmount>0){
    await addDoc(collection(db,"points"),{memberUid:member.uid||member.id,memberEmail:member.email,memberName:member.name||"",amount:-pointUseAmount,reason:"적립금 사용 차감",type:"use",status:"active",createdAt:serverTimestamp()});
  }
  if(member){
    const rate=getPointSettings().orderRate;
    const point=Math.floor(total()*rate/100);
    if(point>0){await addPoint(member,point,"주문 자동 적립","order");}
  }
  cart=[]; coupon=null; couponDiscount=0; pointUseAmount=0; saveCart(); close("cartModal"); alert("주문 완료\n주문번호: "+no);
}
function renderTimes(){const d=$("bookDate")?.value, blocked=state.booking.blockedDates.includes(d); if($("bookTime")) $("bookTime").innerHTML=blocked?"<option>예약 마감</option>":state.booking.times.map(t=>`<option>${t}</option>`).join("")}
async function book(){
  if(!$("bookName").value||!$("bookContact").value||!$("bookDate").value)return alert("예약 정보를 입력하세요.");
  if(isBooked($("bookDate").value,$("bookTime").value)) return alert("이미 예약된 시간입니다. 다른 시간을 선택해 주세요.");
  const bookingTitle=$("bookType").value;
  await addDoc(collection(db,"bookings"),{name:$("bookName").value,contact:$("bookContact").value,type:$("bookType").value,date:$("bookDate").value,time:$("bookTime").value,body:$("bookBody").value,memberUid:member?.uid||member?.id||"",memberEmail:member?.email||"",status:"대기",createdAt:serverTimestamp()});
  await addDoc(collection(db,"notifications"),{target:"admin",title:"새 예약 접수",body:`${$("bookName").value} / ${bookingTitle}`,createdAt:serverTimestamp()});
  await addDoc(collection(db,"notifications"),{memberUid:member?.uid||member?.id||"",memberEmail:member?.email||"",title:"예약 접수 알림",body:`${$("bookDate").value} ${$("bookTime").value} 예약 신청 완료`,createdAt:serverTimestamp()});
  alert("예약 신청 완료");
}
async function track(){
  const o=state.orders.find(x=>x.orderNo===$("trackNo").value.trim()&&x.contact===$("trackContact").value.trim());
  if($("trackResult")) $("trackResult").innerHTML=o?`<div class="card"><b>${o.orderNo}</b><p>${o.status}</p><p>${o.trackingCompany||"등록 전"} ${o.trackingNo||""}</p></div>`:"<p>주문을 찾지 못했습니다.</p>";
}
async function upload(fs,folder){let u=[];for(let f of Array.from(fs||[])){let r=ref(storage,`${folder}/${Date.now()}_${f.name}`);await uploadBytes(r,f);u.push(await getDownloadURL(r))}return u}
async function review(){
  const imgs=await upload($("reviewImages").files,"reviews");
  await addDoc(collection(db,"reviews"),{name:$("reviewName").value,category:$("reviewCategory").value,stars:$("reviewStars").value,body:$("reviewBody").value,images:imgs,approved:false,createdAt:serverTimestamp()});
  close("reviewModal"); alert("후기 등록 요청 완료");
}
async function join(){
  try{
    const cr=await createUserWithEmailAndPassword(auth,$("joinEmail").value.trim(),$("joinPw").value);
    await setDoc(doc(db,"members",cr.user.uid),{uid:cr.user.uid,name:$("joinName").value,contact:$("joinContact").value,email:$("joinEmail").value.trim(),points:0,status:"정상",createdAt:serverTimestamp(),updatedAt:serverTimestamp()},{merge:true});
    await setDoc(doc(db,"users",cr.user.uid),{uid:cr.user.uid,name:$("joinName").value,contact:$("joinContact").value,email:$("joinEmail").value.trim(),points:0,status:"정상",createdAt:serverTimestamp(),updatedAt:serverTimestamp()},{merge:true});
    // 회원가입 자동 쿠폰
    await addDoc(collection(db,"coupons"),{code:"WELCOME-"+Math.random().toString(36).slice(2,7).toUpperCase(),discount:"5000",desc:"신규 회원 쿠폰",used:false,memberUid:cr.user.uid,memberEmail:$("joinEmail").value.trim(),memberName:$("joinName").value,createdAt:serverTimestamp()});
    const set=getPointSettings();
    if(set.signupPoint>0){
      await addDoc(collection(db,"points"),{memberUid:cr.user.uid,memberEmail:$("joinEmail").value.trim(),memberName:$("joinName").value,amount:set.signupPoint,reason:"회원가입 자동 적립",type:"signup",status:"active",createdAt:serverTimestamp()});
    }
    alert("회원가입 완료\n신규 회원 쿠폰이 발급되었습니다."); close("authModal");
  }catch(e){alert(e.code==="auth/email-already-in-use"?"이미 가입된 이메일입니다. 로그인해 주세요.":"회원가입 실패: "+e.message)}
}
async function login(){try{await signInWithEmailAndPassword(auth,$("loginEmail").value.trim(),$("loginPw").value);alert("로그인 완료");close("authModal"); setTimeout(()=>logMemberActivity("로그인 성공","이메일 로그인"),500)}catch(e){alert("로그인 실패")}}
async function loadMember(u){user=u;if(!u){member=null;renderMember();return}
  await ensureMemberSynced(u);let m=state.members?.find(x=>x.id===u.uid); if(!m){const ms=await once("members");m=ms.find(x=>x.id===u.uid)} member=m||{uid:u.uid,email:u.email}; await ensureMemberSynced(member); renderMember(); fill();}
function renderMember(){
  if($("loginOpen"))$("loginOpen").textContent=member?"내 정보":"로그인";
  if($("memberBox"))$("memberBox").innerHTML=member?`<b>${esc(member.name||"회원")}</b><p>${esc(member.email)}</p><button id="logout" class="secondary">로그아웃</button>`:"<p>로그인하면 내 쿠폰과 주문/예약을 확인할 수 있습니다.</p><button class='primary' id='mypageLoginBtn'>로그인/회원가입</button>";
  if($("logout"))$("logout").onclick=()=>signOut(auth);
  if($("mypageLoginBtn"))$("mypageLoginBtn").onclick=()=>open("authModal");
  if(member){loadMyCoupons();loadHistory();renderBenefits()}else{renderBenefits(); if($("myCoupons"))$("myCoupons").innerHTML="<p>로그인 후 확인 가능합니다.</p>"; if($("myHistory"))$("myHistory").innerHTML="<p>로그인 후 확인 가능합니다.</p>";}
}
function loadMyCoupons(){
  const uid=member.uid||member.id, my=state.coupons.filter(c=>c.memberUid===uid||c.memberEmail===member.email);
  if($("myCoupons"))$("myCoupons").innerHTML=my.map(c=>`<div class="myCoupon ${c.used?"used":""}"><b>${c.code}</b><p>${won(money(c.discount))} 할인 / ${c.used?"사용완료":"사용가능"}</p>${!c.used?`<button class="secondary useCoupon" data-code="${c.code}">사용하기</button>`:""}</div>`).join("")||"<p>발급된 쿠폰이 없습니다.</p>";
  document.querySelectorAll(".useCoupon").forEach(b=>b.onclick=()=>{$("couponInput").value=b.dataset.code;openCart()});
}
function loadHistory(){
  const uid=member.uid||member.id;
  const myO=state.orders.filter(o=>o.memberUid===uid||o.contact===member.contact), myB=state.bookings.filter(b=>b.memberUid===uid||b.contact===member.contact);
  if($("myHistory"))$("myHistory").innerHTML=(myO.map(o=>`<div class="myCoupon"><b>${o.orderNo}</b><p>${o.total} / ${o.status}</p><button class="secondary cancelOrder" data-id="${o.id}">취소 요청</button><button class="secondary refundOrder" data-id="${o.id}">환불 요청</button></div>`).join("")+myB.map(b=>`<div class="myCoupon"><b>${b.type}</b><p>${b.date} ${b.time} / ${b.status}</p><button class="secondary cancelBook" data-id="${b.id}">상담취소 요청</button><button class="secondary refundBook" data-id="${b.id}">환불 요청</button></div>`).join(""))||"<p>내역이 없습니다.</p>";
  document.querySelectorAll(".cancelOrder").forEach(b=>b.onclick=()=>cancel("orders",b.dataset.id));
  document.querySelectorAll(".cancelBook").forEach(b=>b.onclick=()=>cancel("bookings",b.dataset.id));
  document.querySelectorAll(".refundOrder").forEach(b=>b.onclick=()=>requestRefund("orders",b.dataset.id));
  document.querySelectorAll(".refundBook").forEach(b=>b.onclick=()=>requestRefund("bookings",b.dataset.id));
}
async function cancel(col,id){let r=prompt("취소 사유");if(r===null)return;await updateDoc(doc(db,col,id),{status:"취소요청",cancelReason:r,updatedAt:serverTimestamp()});alert("취소 요청 완료")}
function fill(){if(!member)return;[["orderName",member.name],["orderContact",member.contact],["bookName",member.name],["bookContact",member.contact]].forEach(([id,v])=>{if($(id)&&!$(id).value)$(id).value=v||""})}
function openCart(){fill();renderCart();renderPay();open("cartModal")}
async function recordVisit(){try{const key="visit_"+new Date().toISOString().slice(0,10);if(localStorage.cyVisitKey===key)return;localStorage.cyVisitKey=key;await addDoc(collection(db,"visits"),{date:new Date().toISOString().slice(0,10),createdAt:serverTimestamp()})}catch(e){}}
function bind(){
  document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>go(b.dataset.go));
  document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>close(b.dataset.close));
  document.querySelectorAll(".modal").forEach(m=>m.onclick=e=>{if(e.target===m)close(m.id)});
  if($("installGuideClose"))$("installGuideClose").onclick=closeInstallGuide;
  if($("themeToggle"))$("themeToggle").onclick=toggleTheme; if($("installPwaBtn"))$("installPwaBtn").onclick=installPwa; $("loginOpen").onclick=()=>member?go("mypage"):open("authModal");
  $("loginTab").onclick=()=>{$("loginTab").classList.add("on");$("joinTab").classList.remove("on");$("loginPanel").classList.remove("hide");$("joinPanel").classList.add("hide")};
  $("joinTab").onclick=()=>{$("joinTab").classList.add("on");$("loginTab").classList.remove("on");$("joinPanel").classList.remove("hide");$("loginPanel").classList.add("hide")};
  $("joinBtn").onclick=join; $("loginBtn").onclick=login; $("cartOpen").onclick=openCart; $("search").oninput=renderProducts; $("couponApply").onclick=applyCoupon; if($("pointApply"))$("pointApply").onclick=applyPointUse; $("orderBtn").onclick=order; $("bookBtn").onclick=book; $("bookDate").onchange=renderTimes; $("trackBtn").onclick=track; $("reviewOpen").onclick=()=>open("reviewModal"); $("reviewSubmit").onclick=review; if($("savePremiumProfile"))$("savePremiumProfile").onclick=savePremiumProfile; if($("birthdayCouponBtn"))$("birthdayCouponBtn").onclick=()=>issueMarketingCoupon("birthday"); if($("firstBuyCouponBtn"))$("firstBuyCouponBtn").onclick=()=>issueMarketingCoupon("first"); if($("friendReferralBtn"))$("friendReferralBtn").onclick=referralReward; if($("globalSearchInput"))$("globalSearchInput").oninput=globalSearch; if($("makeQrBtn"))$("makeQrBtn").onclick=()=>makeQr($("qrText").value,"qrResult"); if($("checkinBtn"))$("checkinBtn").onclick=checkin; if($("rouletteBtn"))$("rouletteBtn").onclick=roulette; if($("supportSubmit"))$("supportSubmit").onclick=submitSupport; if($("saveMemberEdit"))$("saveMemberEdit").onclick=saveMemberEdit; if($("requestDeleteMember"))$("requestDeleteMember").onclick=requestDeleteMember; if($("sendEmailVerifyBtn"))$("sendEmailVerifyBtn").onclick=sendVerifyEmail; if($("sendResetPwBtn"))$("sendResetPwBtn").onclick=sendResetPassword; if($("epostTrackBtn"))$("epostTrackBtn").onclick=handleEpostTrack; if($("chatSend"))$("chatSend").onclick=sendChat; if($("saveReferral"))$("saveReferral").onclick=saveReferralCode; if($("spSubmit"))$("spSubmit").onclick=submitSpiritual;
}
function startSync(){
  if(started)return; started=true;
  const map={products:"products",consultPrices:"prices",notices:"notices",reviews:"reviews",settings:"settings",coupons:"coupons",orders:"orders",bookings:"bookings",banners:"banners",benefits:"benefits",members:"members",consultRecords:"consultRecords",spiritualRequests:"spiritualRequests",notifications:"notifications",schedules:"schedules",chats:"chats",points:"points",pointSettings:"pointSettings",supportTickets:"supportTickets",faqs:"faqs",reservationBlocks:"reservationBlocks",activityLogs:"activityLogs",refundLogs:"refundLogs",consultationReports:"consultationReports",crmProfiles:"crmProfiles",adminRoles:"adminRoles",realtimeAlerts:"realtimeAlerts",visitorSessions:"visitorSessions",storageFiles:"storageFiles",calendarEvents:"calendarEvents",eventGameSettings:"eventGameSettings",aiSummaries:"aiSummaries",errorLogs:"errorLogs",cacheSettings:"cacheSettings",paymentSettings:"paymentSettings",paymentReceipts:"paymentReceipts",orderStatusLogs:"orderStatusLogs",consultAudioFiles:"consultAudioFiles",crmProProfiles:"crmProProfiles",marketingSettings:"marketingSettings",securitySettings:"securitySettings",aiProReports:"aiProReports",pushSettings:"pushSettings",syncHealth:"syncHealth",uiSettings:"uiSettings",memberGrowthSettings:"memberGrowthSettings",consultOps:"consultOps",scheduleSettings:"scheduleSettings",automationLogs:"automationLogs",builderSections:"builderSections",auditLogs:"auditLogs",wishlists:"wishlists",recentViews:"recentViews",restockAlerts:"restockAlerts",chatStatuses:"chatStatuses",events:"events",memberFiles:"memberFiles",seoSettings:"seoSettings",adminRoles:"adminRoles",epostShipments:"epostShipments"};
  Object.entries(map).forEach(([col,key])=>listen(col,key));
}
initTheme(); bind(); hydrate(); renderAll(); startSync(); recordVisit(); trackVisitor(); onAuthStateChanged(auth,loadMember);


// ===== 8.5 예약/상품 버튼 사업자정보 이동 오류 최종 수정 =====
const FIX_BOOKING_PAGE_ID = "booking";
const FIX_PRODUCT_PAGE_ID = "shop";

function safeGoFixed(pageId){
  try{
    if(typeof go === "function") {
      go(pageId);
      return;
    }
    document.querySelectorAll(".page").forEach(p=>p.classList.remove("on","active"));
    const target=document.getElementById(pageId);
    if(target) target.classList.add("on","active");
    document.querySelectorAll(".bottomNav button").forEach(b=>b.classList.remove("on"));
    window.scrollTo({top:0, behavior:"smooth"});
  }catch(e){}
}

function forceMainButtonsRoute(){
  const routeMap = [
    {words:["상담 예약하기","예약"], target:FIX_BOOKING_PAGE_ID},
    {words:["상품 보기","상품 구매하기","상품"], target:FIX_PRODUCT_PAGE_ID}
  ];

  document.querySelectorAll("button,a").forEach(el=>{
    const txt=(el.textContent||"").replace(/\s+/g," ").trim();
    for(const r of routeMap){
      if(r.words.some(w=>txt === w || txt.includes(w))){
        // 단, 사업자정보/우체국/결제 안내 안쪽의 텍스트는 제외
        const parentText=(el.closest(".businessInfo,.businessCard,#businessInfo,#businessPage")?.textContent||"");
        if(parentText && !txt.includes("예약") && !txt.includes("상품")) continue;

        el.setAttribute("data-go", r.target);
        el.removeAttribute("href");
        el.onclick = function(e){
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          safeGoFixed(r.target);
          return false;
        };
      }
    }
  });

  // 홈 히어로 버튼은 순서 기준으로도 강제 지정
  const hero=document.querySelector(".premiumHero");
  if(hero){
    const buttons=[...hero.querySelectorAll("button,a")];
    const reserveBtn=buttons.find(b=>(b.textContent||"").includes("상담"));
    const productBtn=buttons.find(b=>(b.textContent||"").includes("상품"));
    if(reserveBtn){
      reserveBtn.setAttribute("data-go", FIX_BOOKING_PAGE_ID);
      reserveBtn.onclick=(e)=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();safeGoFixed(FIX_BOOKING_PAGE_ID);return false;};
    }
    if(productBtn){
      productBtn.textContent="상품 보기";
      productBtn.setAttribute("data-go", FIX_PRODUCT_PAGE_ID);
      productBtn.onclick=(e)=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();safeGoFixed(FIX_PRODUCT_PAGE_ID);return false;};
    }
  }
}

setInterval(forceMainButtonsRoute, 500);
window.addEventListener("load", forceMainButtonsRoute);
document.addEventListener("click", function(e){
  const el=e.target.closest("button,a");
  if(!el) return;
  const txt=(el.textContent||"").replace(/\s+/g," ").trim();
  if(txt.includes("상담 예약하기") || txt==="예약"){
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    safeGoFixed(FIX_BOOKING_PAGE_ID);
  }
  if(txt.includes("상품 보기") || txt.includes("상품 구매하기") || txt==="상품"){
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    safeGoFixed(FIX_PRODUCT_PAGE_ID);
  }
}, true);


// ===== 8.6 홈/예약/상품 라우팅 최종 수정 =====
const FINAL_HOME_ID = "home";
const FINAL_BOOKING_ID = "reserve";
const FINAL_PRODUCTS_ID = "shop";
const FINAL_BUSINESS_IDS = ['businessInfoHome'];

function finalShowPage(pageId){
  try{
    const pages=[...document.querySelectorAll(".page")];
    pages.forEach(p=>{
      p.classList.add("hide");
      p.classList.remove("on","active");
      p.style.display="none";
    });
    const target=document.getElementById(pageId);
    if(target){
      target.classList.remove("hide");
      target.classList.add("on","active");
      target.style.display="block";
    }
    FINAL_BUSINESS_IDS.forEach(id=>{
      const b=document.getElementById(id);
      if(b && id!==pageId){
        b.classList.add("hide");
        b.classList.remove("on","active");
        b.style.display="none";
      }
    });
    document.querySelectorAll(".bottomNav button").forEach(btn=>{
      btn.classList.remove("on");
      const t=(btn.textContent||"").trim();
      if((pageId===FINAL_HOME_ID && t.includes("홈")) ||
         (pageId===FINAL_BOOKING_ID && t.includes("예약")) ||
         (pageId===FINAL_PRODUCTS_ID && t.includes("상품"))){
        btn.classList.add("on");
      }
    });
    window.scrollTo({top:0,behavior:"smooth"});
  }catch(e){ console.warn("finalShowPage", e); }
}

function finalRouteForText(txt){
  txt=(txt||"").replace(/\s+/g," ").trim();
  if(txt==="홈") return FINAL_HOME_ID;
  if(txt==="상담 예약하기" || txt==="예약") return FINAL_BOOKING_ID;
  if(txt==="상품 보기" || txt==="상품 구매하기" || txt==="상품") return FINAL_PRODUCTS_ID;
  return "";
}

function finalFixNavButtons(){
  document.querySelectorAll("button,a").forEach(el=>{
    const txt=(el.textContent||"").replace(/\s+/g," ").trim();
    const route=finalRouteForText(txt);
    if(route){
      el.setAttribute("data-go", route);
      el.removeAttribute("href");
      el.onclick=function(e){
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        finalShowPage(route);
        return false;
      };
      if(txt==="상품 구매하기") el.textContent="상품 보기";
    }
  });
}

document.addEventListener("click", function(e){
  const el=e.target.closest("button,a");
  if(!el) return;
  const route=finalRouteForText(el.textContent||"");
  if(route){
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    finalShowPage(route);
    return false;
  }
}, true);

setInterval(finalFixNavButtons, 300);
window.addEventListener("load", ()=>{ finalFixNavButtons(); });


// ===== 8.7 최종 라우팅/하단메뉴 안정화 =====
window.CHEONYUL_STABLE_NAV = [["홈","home"],["예약","reserve"],["상품","shop"],["후기","reviews"],["문의","supportPage"],["예약이력","bookingHistory"],["마이","mypage"]];
window.CHEONYUL_BUSINESS_IDS = ["businessInfoHome"];
function cyExists(id){return !!document.getElementById(id)}
function cyResolve(x){x=(x||'').replace(/\s+/g,' ').trim();let m=Object.fromEntries(window.CHEONYUL_STABLE_NAV); if(m[x])return m[x]; if(cyExists(x))return x; if(x.includes('상담 예약')||x==='예약')return 'reserve'; if(x.includes('상품'))return 'shop'; if(x.includes('후기'))return 'reviews'; if(x.includes('문의'))return 'supportPage'; if(x.includes('예약이력'))return 'bookingHistory'; if(x.includes('마이')||x.includes('내 정보'))return 'mypage'; if(x.includes('홈'))return 'home'; return '';}
function cyShow(id){id=cyResolve(id)||'home'; if(!cyExists(id)) id='home'; document.querySelectorAll('.page').forEach(p=>{p.classList.add('hide');p.classList.remove('on','active');p.style.display='none';}); let t=document.getElementById(id); if(t){t.classList.remove('hide');t.classList.add('on','active');t.style.display='block';} window.CHEONYUL_BUSINESS_IDS.forEach(bid=>{let b=document.getElementById(bid); if(b&&bid!==id){b.classList.add('hide');b.classList.remove('on','active');b.style.display='none';}}); document.querySelectorAll('.bottomNav button').forEach(b=>b.classList.toggle('on',b.dataset.go===id)); sessionStorage.setItem('cheonyul_current_page',id); window.scrollTo({top:0,behavior:'smooth'});}
function cyBuildNav(){let nav=document.querySelector('.bottomNav'); if(!nav){nav=document.createElement('nav');nav.className='bottomNav';document.body.appendChild(nav);} let html=window.CHEONYUL_STABLE_NAV.filter(([l,id])=>cyExists(id)).map(([l,id])=>`<button type="button" data-go="${id}">${l}</button>`).join(''); if(nav.dataset.stableFinal!=='870'||nav.innerHTML.trim()!==html.trim()){nav.innerHTML=html;nav.dataset.stableFinal='870';} nav.querySelectorAll('button').forEach(btn=>btn.onclick=e=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();cyShow(btn.dataset.go);return false;});}
function cyFixBtns(){document.querySelectorAll('button,a').forEach(el=>{let text=(el.textContent||'').replace(/\s+/g,' ').trim();let route=cyResolve(text); if(['홈','예약','상담 예약하기','상품','상품 보기','상품 구매하기','후기','문의','예약이력','마이','내 정보'].includes(text)){el.setAttribute('data-go',route);el.removeAttribute('href'); if(text==='상품 구매하기')el.textContent='상품 보기'; el.onclick=e=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();cyShow(route);return false;};} });}
function cyHomeRescue(){let h=document.getElementById('home'), r=document.getElementById('homeRescuePremium'); if(h&&r) h.prepend(r);}
document.addEventListener('click',function(e){let el=e.target.closest('button,a'); if(!el)return; let txt=(el.textContent||'').replace(/\s+/g,' ').trim(); if(['홈','예약','상담 예약하기','상품','상품 보기','상품 구매하기','후기','문의','예약이력','마이','내 정보'].includes(txt)){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();cyShow(cyResolve(txt));return false;}},true);
function cyInit(){cyBuildNav();cyFixBtns();cyHomeRescue();let cur=sessionStorage.getItem('cheonyul_current_page')||'home'; if(!document.querySelector('.page.on,.page.active'))cyShow(cur);}
window.addEventListener('load',()=>setTimeout(cyInit,100)); setInterval(()=>{cyBuildNav();cyFixBtns();cyHomeRescue();},700); window.go=cyShow;
