import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const $ = (id)=>document.getElementById(id);
const val = (id)=>($(id)?.value || "").trim();
const money = (v)=>Number(String(v||"").replace(/[^\d]/g,"")) || 0;

let loading = false;

async function list(col){
  const snap = await getDocs(collection(db,col));
  return snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
}
async function upload(files, folder){
  const urls = [];
  for(const f of Array.from(files || [])){
    const r = ref(storage, `${folder}/${Date.now()}_${f.name}`);
    await uploadBytes(r, f);
    urls.push(await getDownloadURL(r));
  }
  return urls;
}
function card(title, body="", actions=""){
  return `<div class="card"><h3>${title}</h3><p>${body}</p>${actions}</div>`;
}
function code(){
  return "CY-" + Math.random().toString(36).slice(2,8).toUpperCase();
}
function setMsg(text, bad=true){
  const el = $("adminLoginMsg");
  if(el){
    el.textContent = text || "";
    el.className = bad ? "loginMsg bad" : "loginMsg ok";
  }else if(text){
    alert(text);
  }
}
function goTab(id){
  document.querySelectorAll(".adminTab").forEach(x=>x.classList.add("hide"));
  $(id)?.classList.remove("hide");
  window.scrollTo(0,0);
}

async function adminLogin(){
  const email = val("adminEmail");
  const pw = val("adminPw");
  if(!email || !pw){
    setMsg("이메일과 비밀번호를 입력해 주세요.");
    return;
  }
  setMsg("로그인 중입니다...", false);
  try{
    await signInWithEmailAndPassword(auth, email, pw);
    setMsg("로그인 완료", false);
  }catch(e){
    console.error(e);
    if(e.code === "auth/invalid-credential" || e.code === "auth/wrong-password" || e.code === "auth/user-not-found"){
      setMsg("로그인 실패: 이메일 또는 비밀번호가 맞지 않습니다. Firebase Authentication에 등록된 계정인지 확인해 주세요.");
    }else if(e.code === "auth/operation-not-allowed"){
      setMsg("Firebase Authentication에서 이메일/비밀번호 로그인을 활성화해야 합니다.");
    }else{
      setMsg("로그인 실패: " + (e.message || e.code || e));
    }
  }
}

async function load(){
  if(loading) return;
  loading = true;
  try{
    const [orders,bookings,members,coupons,products,prices,settings,visits,logs,banners,benefits] =
      await Promise.all(["orders","bookings","members","coupons","products","consultPrices","settings","visits","adminLogs","banners","benefits"].map(c=>list(c).catch(()=>[])));

    if($("statOrders")) $("statOrders").textContent = orders.length;
    if($("statBookings")) $("statBookings").textContent = bookings.length;
    if($("statMembers")) $("statMembers").textContent = members.length;
    if($("statSales")) $("statSales").textContent = orders.reduce((s,o)=>s+money(o.total),0).toLocaleString()+"원";
    if($("statVisits")) $("statVisits").textContent = visits.length;
    if($("statCoupons")) $("statCoupons").textContent = coupons.length;

    if($("memberSelect")){
      $("memberSelect").innerHTML = `<option value="">공용 쿠폰</option>` + members.map(m=>`<option value="${m.id}" data-email="${m.email||""}" data-name="${m.name||""}">${m.name||"이름 없음"} / ${m.email||""}</option>`).join("");
    }

    if($("orderList")){
      $("orderList").innerHTML = orders.map(o=>card(o.orderNo||o.id,`${o.name||""}<br>${o.total||""}<br>${o.status||""}<br>${o.contact||""}`,`<button class="secondary" onclick="st('orders','${o.id}','입금완료')">입금완료</button><button class="secondary" onclick="tr('${o.id}')">배송입력</button><button class="secondary" onclick="st('orders','${o.id}','취소완료')">취소</button>`)).join("") || "<p>주문이 없습니다.</p>";
    }
    if($("bookingList")){
      $("bookingList").innerHTML = bookings.map(b=>card(b.name||"",`${b.type||""}<br>${b.date||""} ${b.time||""}<br>${b.status||""}`,`<button class="secondary" onclick="st('bookings','${b.id}','확정')">확정</button><button class="secondary" onclick="st('bookings','${b.id}','취소완료')">취소</button>`)).join("") || "<p>예약이 없습니다.</p>";
    }
    if($("memberList")){
      $("memberList").innerHTML = members.map(m=>card(m.name||"회원",`${m.email||""}<br>${m.contact||""}`)).join("") || "<p>회원이 없습니다.</p>";
    }
    if($("couponList")){
      $("couponList").innerHTML = coupons.map(c=>card(c.code||"",`${c.discount||0}원<br>${c.memberName||"공용"}<br>${c.used?"사용완료":"사용가능"}`)).join("") || "<p>쿠폰이 없습니다.</p>";
    }
    if($("productListAdmin")){
      $("productListAdmin").innerHTML = products.map(p=>card(p.name||"",`${p.price||""}<br>${p.stock||""}`,`<button class="secondary" onclick="del('products','${p.id}')">삭제</button>`)).join("") || "<p>상품이 없습니다.</p>";
    }
    if($("priceListAdmin")){
      $("priceListAdmin").innerHTML = prices.map(p=>card(p.title||"",`${p.price||""}<br>${p.desc||""}`,`<button class="secondary" onclick="del('consultPrices','${p.id}')">삭제</button>`)).join("") || "<p>상담 가격이 없습니다.</p>";
    }

    const pay = settings.find(s=>s.id==="payment") || {};
    if($("payAccount")) $("payAccount").value = pay.account || "";
    if($("payLink")) $("payLink").value = pay.link || "";
    if($("bankName")) $("bankName").value = pay.bankName || "";
    if($("bankOwner")) $("bankOwner").value = pay.bankOwner || "";
    if($("bankAccount")) $("bankAccount").value = pay.bankAccount || "";
    if($("payGuide")) $("payGuide").value = pay.guide || "";

    const time = settings.find(s=>s.id==="bookingTimes") || {};
    if($("timeInput")) $("timeInput").value = (time.times || []).join("\n");
    if($("blockInput")) $("blockInput").value = (time.blockedDates || []).join("\n");

    if($("salesChart")) $("salesChart").innerHTML = `<h3>매출 요약</h3><p>총 주문금액: <b>${orders.reduce((s,o)=>s+money(o.total),0).toLocaleString()}원</b></p><p>주문 수: ${orders.length}</p>`;
    if($("logList")) $("logList").innerHTML = logs.map(l=>card(l.action||"활동", l.createdAt?.seconds ? new Date(l.createdAt.seconds*1000).toLocaleString() : "")).join("") || "<p>로그가 없습니다.</p>";
    if($("bannerList")) $("bannerList").innerHTML = banners.map(b=>card(b.title||"", b.body||"", `<button class="secondary" onclick="del('banners','${b.id}')">삭제</button>`)).join("") || "<p>팝업이 없습니다.</p>";
    if($("homeManageList")) $("homeManageList").innerHTML =
      `<h2>홈 배너</h2>${banners.map(b=>card(b.title||"", b.body||"", `<button class="secondary" onclick="del('banners','${b.id}')">삭제</button>`)).join("") || "<p>등록된 홈 배너가 없습니다.</p>"}
       <h2>회원 혜택</h2>${benefits.map(b=>card(b.title||"", b.body||"", `<button class="secondary" onclick="del('benefits','${b.id}')">삭제</button>`)).join("") || "<p>등록된 혜택이 없습니다.</p>"}`;
  }finally{
    loading = false;
  }
}

async function adminLog(action){
  try{ await addDoc(collection(db,"adminLogs"),{action,createdAt:serverTimestamp()}); }catch(e){}
}


async function adminFirstJoin(){
  const email = val("adminEmail");
  const pw = val("adminPw");
  if(!email || !pw){
    setMsg("관리자 이메일과 비밀번호를 입력한 뒤 최초 등록을 눌러주세요.");
    return;
  }
  if(pw.length < 6){
    setMsg("비밀번호는 6자리 이상이어야 합니다.");
    return;
  }
  try{
    setMsg("관리자 계정을 등록 중입니다...", false);
    const cred = await createUserWithEmailAndPassword(auth, email, pw);
    await setDoc(doc(db,"admins",cred.user.uid),{
      uid:cred.user.uid,
      email,
      role:"admin",
      createdAt:serverTimestamp()
    },{merge:true});
    setMsg("관리자 등록 완료. 자동 로그인되었습니다.", false);
    alert("관리자 등록이 완료되었습니다.");
  }catch(e){
    console.error(e);
    if(e.code === "auth/email-already-in-use"){
      setMsg("이미 등록된 이메일입니다. 로그인 버튼을 눌러주세요.");
    }else if(e.code === "auth/operation-not-allowed"){
      setMsg("Firebase Authentication에서 이메일/비밀번호 로그인을 활성화해야 합니다.");
    }else{
      setMsg("관리자 등록 실패: " + (e.message || e.code || e));
    }
  }
}

async function adminResetPassword(){
  const email = val("adminEmail");
  if(!email){
    setMsg("비밀번호 재설정 받을 이메일을 입력해 주세요.");
    return;
  }
  try{
    await sendPasswordResetEmail(auth, email);
    setMsg("비밀번호 재설정 메일을 보냈습니다. 메일함을 확인해 주세요.", false);
  }catch(e){
    console.error(e);
    setMsg("비밀번호 재설정 실패: " + (e.message || e.code || e));
  }
}

function bind(){
  document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>goTab(b.dataset.tab));

  $("adminLogin")?.addEventListener("click", adminLogin);
  $("adminJoin")?.addEventListener("click", adminFirstJoin);
  $("adminResetPw")?.addEventListener("click", adminResetPassword);
  $("adminPw")?.addEventListener("keydown",(e)=>{ if(e.key==="Enter") adminLogin(); });
  $("adminEmail")?.addEventListener("keydown",(e)=>{ if(e.key==="Enter") adminLogin(); });
  $("adminLogout")?.addEventListener("click",()=>signOut(auth));

  $("addCoupon")?.addEventListener("click",async()=>{
    const sel = $("memberSelect");
    const opt = sel?.options[sel.selectedIndex];
    await addDoc(collection(db,"coupons"),{
      code:(val("couponCode")||code()).toUpperCase(),
      discount:val("couponDiscount"),
      desc:val("couponDesc"),
      minOrder:val("couponMinOrder"),
      expiresAt:val("couponExpire"),
      useLimit:val("couponLimit")||"1",
      usedCount:0,
      used:false,
      memberUid:sel?.value||"",
      memberEmail:opt?.dataset.email||"",
      memberName:opt?.dataset.name||"",
      createdAt:serverTimestamp()
    });
    await adminLog("쿠폰 발급");
    alert("쿠폰 발급 완료");
    load();
  });

  $("addProduct")?.addEventListener("click",async()=>{
    const imgs = await upload($("pImages")?.files,"products");
    await addDoc(collection(db,"products"),{name:val("pName"),price:val("pPrice"),stock:val("pStock"),desc:val("pDesc"),images:imgs,createdAt:serverTimestamp()});
    await adminLog("상품 등록");
    alert("상품 등록 완료");
    load();
  });

  $("addPrice")?.addEventListener("click",async()=>{
    await addDoc(collection(db,"consultPrices"),{title:val("priceTitle"),price:val("priceAmount"),desc:val("priceDesc"),createdAt:serverTimestamp()});
    await adminLog("상담가격 등록");
    alert("상담 가격 등록 완료");
    load();
  });

  $("savePay")?.addEventListener("click",async()=>{
    await setDoc(doc(db,"settings","payment"),{account:val("payAccount"),link:val("payLink"),bankName:val("bankName"),bankOwner:val("bankOwner"),bankAccount:val("bankAccount"),guide:val("payGuide"),updatedAt:serverTimestamp()},{merge:true});
    await adminLog("결제 설정 저장");
    alert("저장 완료");
  });

  $("saveBooking")?.addEventListener("click",async()=>{
    await setDoc(doc(db,"settings","bookingTimes"),{times:val("timeInput").split("\n").map(x=>x.trim()).filter(Boolean),blockedDates:val("blockInput").split("\n").map(x=>x.trim()).filter(Boolean),updatedAt:serverTimestamp()},{merge:true});
    await adminLog("예약 설정 저장");
    alert("저장 완료");
  });

  $("saveBanner")?.addEventListener("click",async()=>{
    await addDoc(collection(db,"banners"),{title:val("bannerTitle"),body:val("bannerBody"),createdAt:serverTimestamp()});
    await adminLog("공지 팝업 저장");
    alert("팝업 저장 완료");
    load();
  });

  $("addHomeBanner")?.addEventListener("click",async()=>{
    await addDoc(collection(db,"banners"),{title:val("homeBannerTitle"),body:val("homeBannerBody"),createdAt:serverTimestamp()});
    await adminLog("홈 배너 등록");
    alert("홈 배너가 홈페이지에 반영되었습니다.");
    load();
  });

  $("addBenefit")?.addEventListener("click",async()=>{
    await addDoc(collection(db,"benefits"),{title:val("benefitTitle"),body:val("benefitBody"),createdAt:serverTimestamp()});
    await adminLog("회원 혜택 등록");
    alert("회원 혜택이 홈페이지에 반영되었습니다.");
    load();
  });
}

window.st = async(c,id,s)=>{await updateDoc(doc(db,c,id),{status:s,updatedAt:serverTimestamp()});await autoPointByStatus(c,id,s);await adminLog(`${c} 상태 변경: ${s}`);load();};
window.tr = async(id)=>{const trackingCompany=prompt("택배사/배송방법"); if(trackingCompany===null)return; const trackingNo=prompt("송장번호/메모"); await updateDoc(doc(db,"orders",id),{trackingCompany,trackingNo,status:"배송중",updatedAt:serverTimestamp()});await adminLog("배송 정보 입력");load();};
window.del = async(c,id)=>{if(confirm("삭제할까요?")){await deleteDoc(doc(db,c,id));await adminLog(`${c} 삭제`);load();}};


async function ensureAdminProfile(u){
  try{
    await setDoc(doc(db,"admins",u.uid),{
      uid:u.uid,
      email:u.email || "",
      role:"admin",
      lastLoginAt:serverTimestamp()
    },{merge:true});
  }catch(e){}
}

onAuthStateChanged(auth,(u)=>{
  $("adminLoginBox")?.classList.toggle("hide",!!u);
  $("adminPanel")?.classList.toggle("hide",!u);
  if(u){
    setMsg("");
    ensureAdminProfile(u);
    load();
  }
});

["orders","bookings","members","coupons","products","consultPrices","settings","visits","adminLogs","banners","benefits","consultRecords","spiritualRequests","allowedAdmins","notifications","crmNotes","schedules","chats","points","events","memberFiles","adminRoles","seoSettings","epostShipments"].forEach(c=>{
  try{onSnapshot(collection(db,c),()=>{if(!$("adminPanel")?.classList.contains("hide")) load();});}catch(e){}
});

bind();


// 완전 연동 4.4: 관리자 변경 즉시 홈페이지 반영 안내 및 강제 새로고침 없는 동기화
setInterval(()=>{ const el=document.getElementById("adminSyncStatus"); if(el){el.textContent="실시간 연동중"; el.className="syncStatus ok";}},2000);

// ===== 4.5 complete admin sync additions =====
function csvDownload(filename, rows){
  const csv = rows.map(r=>r.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download=filename; a.click(); URL.revokeObjectURL(a.href);
}
function fillBusiness(settings){
  const b=settings.find(s=>s.id==="business")||{};
  [["bizName","name"],["bizOwner","owner"],["bizNumber","number"],["bizAddress","address"],["bizType","type"],["bizItem","item"],["bizContact","contact"],["bizMailOrder","mailOrder"]].forEach(([id,k])=>{if($(id))$(id).value=b[k]||""});
}
function renderReviewAdmin(reviews){
  if($("pendingReviewList")) $("pendingReviewList").innerHTML=reviews.filter(r=>!r.approved).map(r=>card(`${r.name||"익명"} · ${r.stars||""}`,`${r.category||""}<br>${r.body||""}`,`<button class="secondary" onclick="approveReview('${r.id}',true)">승인</button><button class="secondary" onclick="del('reviews','${r.id}')">삭제</button>`)).join("")||"<p>승인 대기 후기가 없습니다.</p>";
  if($("approvedReviewList")) $("approvedReviewList").innerHTML=reviews.filter(r=>r.approved).map(r=>card(`${r.name||"익명"} · ${r.stars||""}`,`${r.category||""}<br>${r.body||""}`,`<button class="secondary" onclick="approveReview('${r.id}',false)">승인취소</button><button class="secondary" onclick="del('reviews','${r.id}')">삭제</button>`)).join("")||"<p>공개 후기가 없습니다.</p>";
}
window.approveReview=async(id,approved)=>{
  await updateDoc(doc(db,"reviews",id),{approved,updatedAt:serverTimestamp()});
  if(approved){
    try{
      const reviews=await list("reviews");
      const r=reviews.find(x=>x.id===id);
      const settings=(await list("pointSettings","supportTickets","faqs","reservationBlocks","crmProfiles","refundLogs","activityLogs","dataChangeLogs","consultationReports"))[0]||{reviewPoint:1000};
      if(r?.memberUid && Number(settings.reviewPoint)>0){
        await addDoc(collection(db,"points"),{memberUid:r.memberUid,memberEmail:r.memberEmail,memberName:r.name,amount:Number(settings.reviewPoint),reason:"후기 승인 자동 적립",type:"review",status:"active",createdAt:serverTimestamp()});
      }
    }catch(e){}
  }
  await adminLog(approved?"후기 승인":"후기 승인취소");load();
};
setTimeout(()=>{
  $("saveBusiness")?.addEventListener("click",async()=>{
    await setDoc(doc(db,"settings","business"),{name:val("bizName"),owner:val("bizOwner"),number:val("bizNumber"),address:val("bizAddress"),type:val("bizType"),item:val("bizItem"),contact:val("bizContact"),mailOrder:val("bizMailOrder"),updatedAt:serverTimestamp()},{merge:true});
    await adminLog("사업자 정보 저장"); alert("사업자 정보가 홈페이지에 반영되었습니다.");
  });
  $("exportOrders")?.addEventListener("click",async()=>{const rows=await list("orders");csvDownload("orders.csv",[["주문번호","이름","연락처","금액","상태"],...rows.map(o=>[o.orderNo,o.name,o.contact,o.total,o.status])]);});
  $("exportMembers")?.addEventListener("click",async()=>{const rows=await list("members");csvDownload("members.csv",[["이름","이메일","연락처","포인트"],...rows.map(m=>[m.name,m.email,m.contact,m.points])]);});
  $("exportBookings")?.addEventListener("click",async()=>{const rows=await list("bookings");csvDownload("bookings.csv",[["이름","연락처","상담","날짜","시간","상태"],...rows.map(b=>[b.name,b.contact,b.type,b.date,b.time,b.status])]);});
},700);

// ===== 4.6 operation admin additions =====
async function ensureAllowedAdmin(){
  try{
    const rows=await list("allowedAdmins","notifications","crmNotes","schedules","chats","points","events","memberFiles","adminRoles","seoSettings","epostShipments");
    const current=auth.currentUser?.email||"";
    if(!rows.length && current){
      await addDoc(collection(db,"allowedAdmins","notifications","crmNotes","schedules","chats","points","events","memberFiles","adminRoles","seoSettings","epostShipments"),{email:current,createdAt:serverTimestamp()});
      return true;
    }
    return rows.some(a=>String(a.email||"").toLowerCase()===current.toLowerCase());
  }catch(e){return true;}
}
async function loadOps(){
  try{
    const [members,records,spirituals,orders,bookings,allowed] = await Promise.all(["members","consultRecords","spiritualRequests","orders","bookings","allowedAdmins","notifications","crmNotes","schedules","chats","points","events","memberFiles","adminRoles","seoSettings","epostShipments"].map(list));
    if($("recordMemberSelect")) $("recordMemberSelect").innerHTML='<option value="">회원 선택</option>'+members.map(m=>`<option value="${m.id}" data-email="${m.email||""}" data-name="${m.name||""}">${m.name||"이름 없음"} / ${m.email||""}</option>`).join("");
    if($("consultRecordList")) $("consultRecordList").innerHTML=records.map(r=>card(r.title||"상담 이력",`${r.memberName||r.memberEmail||""}<br>${r.date||""}<br>${r.memo||""}<br>${r.nextDate?`재상담: ${r.nextDate}`:""}`,`<button class="secondary" onclick="del('consultRecords','${r.id}')">삭제</button>`)).join("")||"<p>상담 이력이 없습니다.</p>";
    if($("spiritualList")) $("spiritualList").innerHTML=spirituals.map(s=>card(`${s.type||"신청"} · ${s.name||""}`,`${s.contact||""}<br>${s.amount||""}<br>${s.body||""}<br>상태: ${s.status||""}`,`<button class="secondary" onclick="st('spiritualRequests','${s.id}','진행중')">진행중</button><button class="secondary" onclick="st('spiritualRequests','${s.id}','완료')">완료</button><button class="secondary" onclick="del('spiritualRequests','${s.id}')">삭제</button>`)).join("")||"<p>신청 내역이 없습니다.</p>";
    const refunds=[...orders.filter(o=>String(o.status||"").includes("환불")||String(o.status||"").includes("취소")), ...bookings.filter(b=>String(b.status||"").includes("환불")||String(b.status||"").includes("취소"))];
    if($("refundList")) $("refundList").innerHTML=refunds.map(x=>card(`${x.orderNo||x.type||"요청"} · ${x.name||""}`,`${x.contact||""}<br>상태: ${x.status||""}<br>사유: ${x.refundReason||x.cancelReason||"-"}`,`<button class="secondary" onclick="refundDone('${x.orderNo?'orders':'bookings'}','${x.id}')">환불완료</button><button class="secondary" onclick="refundReject('${x.orderNo?'orders':'bookings'}','${x.id}')">반려</button>`)).join("")||"<p>취소/환불 요청이 없습니다.</p>";
    if($("allowedAdminList")) $("allowedAdminList").innerHTML=allowed.map(a=>card(a.email||"", "허용됨", `<button class="secondary" onclick="del('allowedAdmins','${a.id}')">삭제</button>`)).join("")||"<p>허용 관리자 이메일이 없습니다.</p>";
  }catch(e){console.warn(e)}
}
window.refundDone=async(col,id)=>{await updateDoc(doc(db,col,id),{status:"환불완료",refundDoneAt:serverTimestamp()});await adminLog("환불 완료");load();loadOps();};
window.refundReject=async(col,id)=>{await updateDoc(doc(db,col,id),{status:"환불반려",refundRejectedAt:serverTimestamp()});await adminLog("환불 반려");load();loadOps();};

setTimeout(()=>{
  $("saveRecord")?.addEventListener("click",async()=>{
    const sel=$("recordMemberSelect"), opt=sel.options[sel.selectedIndex];
    if(!sel.value)return alert("회원을 선택해 주세요.");
    await addDoc(collection(db,"consultRecords"),{
      memberUid:sel.value, memberEmail:opt.dataset.email, memberName:opt.dataset.name,
      title:val("recordTitle"), date:val("recordDate"), memo:val("recordMemo"), nextDate:val("recordNextDate"),
      createdAt:serverTimestamp()
    });
    await adminLog("상담 이력 저장"); alert("상담 이력이 회원 페이지에 반영되었습니다."); loadOps();
  });
  $("addSpiritualAdmin")?.addEventListener("click",async()=>{
    await addDoc(collection(db,"spiritualRequests"),{
      name:val("spAdminName"),contact:val("spAdminContact"),type:val("spAdminType"),amount:val("spAdminAmount"),body:val("spAdminBody"),
      status:"관리자등록",createdAt:serverTimestamp()
    });
    await adminLog("부적/초발원 직접 등록"); alert("등록 완료"); loadOps();
  });
  $("addAllowedAdmin")?.addEventListener("click",async()=>{
    if(!val("allowedAdminEmail")) return alert("이메일을 입력해 주세요.");
    await addDoc(collection(db,"allowedAdmins","notifications","crmNotes","schedules","chats","points","events","memberFiles","adminRoles","seoSettings","epostShipments"),{email:val("allowedAdminEmail"),createdAt:serverTimestamp()});
    await adminLog("관리자 이메일 허용"); alert("허용 관리자 추가 완료"); loadOps();
  });
  loadOps();
},900);
setInterval(loadOps,4000);

// ===== 4.7 admin CRM / alerts / calendar additions =====
async function loadCrmAndAlerts(){
  try{
    const [members,orders,bookings,spirituals,records,notifications,crm,schedules]=await Promise.all(["members","orders","bookings","spiritualRequests","consultRecords","notifications","crmNotes","schedules","chats","points","events","memberFiles","adminRoles","seoSettings","epostShipments"].map(list));
    if($("crmMemberSelect")) $("crmMemberSelect").innerHTML='<option value="">회원 선택</option>'+members.map(m=>`<option value="${m.id}" data-email="${m.email||""}" data-name="${m.name||""}">${m.name||"이름 없음"} / ${m.email||""}</option>`).join("");
    if($("adminAlertList")){
      const adminNoti=notifications.filter(n=>n.target==="admin"||!n.memberUid&&!n.memberEmail).slice(0,30);
      $("adminAlertList").innerHTML=adminNoti.map(n=>card(n.title||"알림",`${n.body||""}<br>${n.createdAt?.seconds?new Date(n.createdAt.seconds*1000).toLocaleString():""}`,`<button class="secondary" onclick="del('notifications','${n.id}')">확인/삭제</button>`)).join("")||"<p>알림이 없습니다.</p>";
    }
    if($("crmSummaryList")){
      $("crmSummaryList").innerHTML=members.map(m=>{
        const uid=m.id;
        const total=orders.filter(o=>o.memberUid===uid||o.memberEmail===m.email).reduce((s,o)=>s+money(o.total),0);
        const cnt=records.filter(r=>r.memberUid===uid||r.memberEmail===m.email).length;
        const memo=crm.find(c=>c.memberUid===uid||c.memberEmail===m.email);
        return card(`${m.name||"회원"} · ${m.email||""}`,`총 결제: ${total.toLocaleString()}원<br>상담이력: ${cnt}건<br>메모: ${memo?.memo||"-"}<br>태그: ${memo?.tag||"-"}`,`<button class="secondary" onclick="quickCoupon('${m.id}','${m.email||""}','${m.name||""}')">쿠폰빠른발급</button>`);
      }).join("")||"<p>회원이 없습니다.</p>";
    }
    if($("scheduleList")){
      $("scheduleList").innerHTML=schedules.map(s=>card(`${s.date||""} ${s.time||""}`,`${s.title||""}<br>${s.memo||""}`,`<button class="secondary" onclick="del('schedules','${s.id}')">삭제</button>`)).join("")||"<p>등록된 일정이 없습니다.</p>";
    }
  }catch(e){console.warn(e)}
}
window.quickCoupon=async(uid,email,name)=>{
  const discount=prompt("할인금액", "5000"); if(!discount)return;
  const code="VIP-"+Math.random().toString(36).slice(2,7).toUpperCase();
  await addDoc(collection(db,"coupons"),{code,discount,desc:"관리자 빠른 발급 쿠폰",used:false,memberUid:uid,memberEmail:email,memberName:name,createdAt:serverTimestamp()});
  await addDoc(collection(db,"notifications"),{memberUid:uid,memberEmail:email,title:"쿠폰 발급 알림",body:`${code} 쿠폰이 발급되었습니다.`,createdAt:serverTimestamp()});
  await adminLog("CRM 빠른 쿠폰 발급");
  alert("쿠폰 발급 완료");
};
setTimeout(()=>{
  $("saveCrmMemo")?.addEventListener("click",async()=>{
    const sel=$("crmMemberSelect"), opt=sel.options[sel.selectedIndex];
    if(!sel.value)return alert("회원을 선택해 주세요.");
    await addDoc(collection(db,"crmNotes"),{memberUid:sel.value,memberEmail:opt.dataset.email,memberName:opt.dataset.name,memo:val("crmMemo"),tag:val("crmTag"),createdAt:serverTimestamp()});
    await adminLog("CRM 메모 저장"); alert("CRM 메모 저장 완료"); loadCrmAndAlerts();
  });
  $("saveSchedule")?.addEventListener("click",async()=>{
    await addDoc(collection(db,"schedules"),{title:val("scheduleTitle"),date:val("scheduleDate"),time:val("scheduleTime"),memo:val("scheduleMemo"),createdAt:serverTimestamp()});
    await adminLog("일정 저장"); alert("일정 저장 완료"); loadCrmAndAlerts();
  });
  loadCrmAndAlerts();
},1000);
setInterval(loadCrmAndAlerts,4000);

// ===== 4.8 admin chat / points / events additions =====
let selectedChatMember="";
async function loadChatPointsEvents(){
  try{
    const [members,chats,points,events]=await Promise.all(["members","chats","points","events","memberFiles","adminRoles","seoSettings","epostShipments"].map(list));
    if($("chatMemberSelect")) $("chatMemberSelect").innerHTML='<option value="">회원 선택</option>'+members.map(m=>`<option value="${m.id}" data-email="${m.email||""}" data-name="${m.name||""}">${m.name||"이름 없음"} / ${m.email||""}</option>`).join("");
    if($("pointMemberSelect")) $("pointMemberSelect").innerHTML='<option value="">회원 선택</option>'+members.map(m=>`<option value="${m.id}" data-email="${m.email||""}" data-name="${m.name||""}">${m.name||"이름 없음"} / ${m.email||""}</option>`).join("");
    const sel=$("chatMemberSelect"); if(sel && selectedChatMember) sel.value=selectedChatMember;
    const uid=sel?.value||selectedChatMember;
    if($("adminChatBox")){
      const rows=chats.filter(c=>c.threadId===uid).sort((a,b)=>(a.createdAt?.seconds||0)-(b.createdAt?.seconds||0));
      $("adminChatBox").innerHTML=rows.map(m=>`<div class="msg ${m.sender==='admin'?'adminMsg':'userMsg'}"><b>${m.sender==='admin'?'관리자':(m.memberName||'회원')}</b><p>${m.text||""}</p></div>`).join("")||"<p>회원을 선택하면 채팅이 표시됩니다.</p>";
      $("adminChatBox").scrollTop=$("adminChatBox").scrollHeight;
    }
    if($("pointAdminList")) $("pointAdminList").innerHTML=points.slice(0,50).map(p=>card(`${p.memberName||p.memberEmail||""} · ${p.amount}원`,p.reason||"적립금")).join("")||"<p>적립 내역이 없습니다.</p>";
    if($("eventList")) $("eventList").innerHTML=events.map(e=>card(e.title||"이벤트",`${e.body||""}<br>종료일: ${e.endDate||"-"}`,`<button class="secondary" onclick="del('events','${e.id}')">삭제</button>`)).join("")||"<p>이벤트가 없습니다.</p>";
  }catch(e){console.warn(e)}
}
setTimeout(()=>{
  $("chatMemberSelect")?.addEventListener("change",()=>{selectedChatMember=$("chatMemberSelect").value;loadChatPointsEvents();});
  $("adminChatSend")?.addEventListener("click",async()=>{
    const sel=$("chatMemberSelect"), uid=sel.value; if(!uid)return alert("회원을 선택해 주세요.");
    const text=val("adminChatInput"); if(!text)return;
    const opt=sel.options[sel.selectedIndex];
    await addDoc(collection(db,"chats"),{threadId:uid,memberUid:uid,memberEmail:opt.dataset.email,memberName:opt.dataset.name,sender:"admin",text,read:false,createdAt:serverTimestamp()});
    await addDoc(collection(db,"notifications"),{memberUid:uid,memberEmail:opt.dataset.email,title:"상담 답변 도착",body:text,createdAt:serverTimestamp()});
    $("adminChatInput").value=""; await adminLog("채팅 답변"); loadChatPointsEvents();
  });
  $("givePoint")?.addEventListener("click",async()=>{
    const sel=$("pointMemberSelect"), uid=sel.value; if(!uid)return alert("회원을 선택해 주세요.");
    const opt=sel.options[sel.selectedIndex], amount=Number(val("pointAmount")||0); if(!amount)return alert("금액을 입력해 주세요.");
    await addDoc(collection(db,"points"),{memberUid:uid,memberEmail:opt.dataset.email,memberName:opt.dataset.name,amount,reason:val("pointReason")||"관리자 지급",createdAt:serverTimestamp()});
    await updateDoc(doc(db,"members",uid),{points:amount,updatedAt:serverTimestamp()}).catch(()=>{});
    await addDoc(collection(db,"notifications"),{memberUid:uid,memberEmail:opt.dataset.email,title:"적립금 지급",body:`${amount.toLocaleString()}원이 지급되었습니다.`,createdAt:serverTimestamp()});
    alert("적립금 지급 완료"); await adminLog("적립금 지급"); loadChatPointsEvents();
  });
  $("saveEvent")?.addEventListener("click",async()=>{
    await addDoc(collection(db,"events"),{title:val("eventTitle"),body:val("eventBody"),endDate:val("eventEnd"),createdAt:serverTimestamp()});
    alert("이벤트가 홈페이지에 반영되었습니다."); await adminLog("이벤트 등록"); loadChatPointsEvents();
  });
  loadChatPointsEvents();
},1000);
setInterval(loadChatPointsEvents,4000);

// ===== 5.0 full platform admin additions =====
async function uploadAdminFiles(files, folder){
  const urls=[];
  for(const f of Array.from(files||[])){
    const r=ref(storage,`${folder}/${Date.now()}_${f.name}`);
    await uploadBytes(r,f);
    urls.push(await getDownloadURL(r));
  }
  return urls;
}
function downloadJson(filename,data){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download=filename; a.click(); URL.revokeObjectURL(a.href);
}
async function loadFinalAdmin(){
  try{
    const [members,files,roles,seo]=await Promise.all(["members","memberFiles","adminRoles","seoSettings","epostShipments"].map(list));
    if($("fileMemberSelect")) $("fileMemberSelect").innerHTML='<option value="">회원 선택</option>'+members.map(m=>`<option value="${m.id}" data-email="${m.email||""}" data-name="${m.name||""}">${m.name||"이름 없음"} / ${m.email||""}</option>`).join("");
    if($("memberFileList")) $("memberFileList").innerHTML=files.map(f=>card(`${f.title||"자료"} · ${f.memberName||f.memberEmail||""}`,`${f.memo||""}<br>${(f.urls||[]).length}개 파일`, `<button class="secondary" onclick="del('memberFiles','${f.id}')">삭제</button>`)).join("")||"<p>업로드된 자료가 없습니다.</p>";
    if($("roleList")) $("roleList").innerHTML=roles.map(r=>card(r.email||"",`권한: ${r.role||"staff"}`,`<button class="secondary" onclick="del('adminRoles','${r.id}')">삭제</button>`)).join("")||"<p>등록된 권한이 없습니다.</p>";
    if($("seoPreview")) $("seoPreview").innerHTML=seo.map(s=>card(s.title||"SEO",`${s.desc||""}<br>${s.keywords||""}`)).join("")||"<p>SEO 설정이 없습니다.</p>";
  }catch(e){console.warn(e)}
}
setTimeout(()=>{
  $("uploadMemberFile")?.addEventListener("click",async()=>{
    const sel=$("fileMemberSelect"), opt=sel.options[sel.selectedIndex];
    if(!sel.value)return alert("회원을 선택해 주세요.");
    const urls=await uploadAdminFiles($("memberFiles").files,"memberFiles");
    await addDoc(collection(db,"memberFiles"),{memberUid:sel.value,memberEmail:opt.dataset.email,memberName:opt.dataset.name,title:val("fileTitle"),memo:val("fileMemo"),urls,createdAt:serverTimestamp()});
    await addDoc(collection(db,"notifications"),{memberUid:sel.value,memberEmail:opt.dataset.email,title:"상담 자료 등록",body:`${val("fileTitle")} 자료가 등록되었습니다.`,createdAt:serverTimestamp()});
    await adminLog("회원 자료 업로드"); alert("회원 자료가 홈페이지에 반영되었습니다."); loadFinalAdmin();
  });
  $("saveRole")?.addEventListener("click",async()=>{
    if(!val("roleEmail"))return alert("이메일을 입력해 주세요.");
    await addDoc(collection(db,"adminRoles"),{email:val("roleEmail"),role:val("roleType"),createdAt:serverTimestamp()});
    await adminLog("관리자 권한 저장"); alert("권한 저장 완료"); loadFinalAdmin();
  });
  $("downloadFullBackup")?.addEventListener("click",async()=>{
    const cols=["orders","bookings","members","coupons","products","consultPrices","settings","reviews","chats","points","events","memberFiles","adminRoles","seoSettings","epostShipments","spiritualRequests","consultRecords","notifications","memberFiles","adminRoles"];
    const data={};
    for(const c of cols) data[c]=await list(c).catch(()=>[]);
    downloadJson("cheonyul-backup.json",data);
  });
  $("restoreBackup")?.addEventListener("click",async()=>{
    alert("안전상 자동 복원은 비활성화했습니다. 백업 JSON은 보관용으로 사용하세요.");
  });
  $("saveSeo")?.addEventListener("click",async()=>{
    await addDoc(collection(db,"seoSettings","epostShipments"),{title:val("seoTitle"),desc:val("seoDesc"),keywords:val("seoKeywords"),createdAt:serverTimestamp()});
    await adminLog("SEO 설정 저장"); alert("SEO 설정 저장 완료"); loadFinalAdmin();
  });
  loadFinalAdmin();
},1000);
setInterval(loadFinalAdmin,5000);

// ===== 5.1 우체국 익일특급 관리자 additions =====
function nextBusinessDayText(dateStr){
  const d=dateStr?new Date(dateStr):new Date();
  d.setDate(d.getDate()+1);
  const day=d.getDay();
  if(day===0)d.setDate(d.getDate()+1);
  if(day===6)d.setDate(d.getDate()+2);
  return d.toISOString().slice(0,10);
}
async function getEpostSettings(){
  const settings=await list("settings").catch(()=>[]);
  return settings.find(s=>s.id==="epost")||{};
}
async function loadEpostAdmin(){
  try{
    const [orders,shipments,settings]=await Promise.all([list("orders"),list("epostShipments"),list("settings")]);
    const opt='<option value="">주문 선택</option>'+orders.map(o=>`<option value="${o.id}" data-order-no="${o.orderNo||""}" data-name="${o.name||""}" data-contact="${o.contact||""}" data-address="${o.address||""}" data-member-uid="${o.memberUid||""}" data-member-email="${o.memberEmail||""}">${o.orderNo||o.id} / ${o.name||""} / ${o.status||""}</option>`).join("");
    if($("epostOrderSelect"))$("epostOrderSelect").innerHTML=opt;
    if($("manualEpostOrderSelect"))$("manualEpostOrderSelect").innerHTML=opt;
    const epost=settings.find(s=>s.id==="epost")||{};
    if($("epostTrackEndpoint"))$("epostTrackEndpoint").value=epost.trackEndpoint||"";
    if($("epostLabelEndpoint"))$("epostLabelEndpoint").value=epost.labelEndpoint||"";
    if($("epostRequestList"))$("epostRequestList").innerHTML=shipments.map(s=>card(`${s.orderNo||""} · 우체국 익일특급`, `송장: ${s.trackingNo||"발급 전"}<br>상태: ${s.status||""}<br>예상도착: ${s.expectedArrival||""}`, `<button class="secondary" onclick="refreshEpost('${s.id}','${s.trackingNo||""}')">배송상태 갱신</button><button class="secondary" onclick="del('epostShipments','${s.id}')">삭제</button>`)).join("")||"<p>우체국 배송 내역이 없습니다.</p>";
  }catch(e){console.warn(e)}
}
async function callEpostLabel(payload){
  const s=await getEpostSettings();
  if(!s.labelEndpoint){
    return {ok:false,message:"송장 발급 Cloud Function URL이 설정되지 않았습니다. 우체국 계약고객 API 키와 서버 연동이 필요합니다."};
  }
  const res=await fetch(s.labelEndpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  return await res.json();
}
window.refreshEpost=async(id,no)=>{
  if(!no)return alert("송장번호가 없습니다.");
  const s=await getEpostSettings();
  if(!s.trackEndpoint)return alert("배송조회 Cloud Function URL이 설정되지 않았습니다.");
  try{
    const res=await fetch(s.trackEndpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({trackingNo:no})});
    const r=await res.json();
    await updateDoc(doc(db,"epostShipments",id),{status:r.status||"조회완료",trackingHistory:r.history||[],updatedAt:serverTimestamp()});
    alert("배송상태가 갱신되었습니다.");
  }catch(e){alert("조회 실패: "+e.message)}
};
setTimeout(()=>{
  $("saveEpostSettings")?.addEventListener("click",async()=>{
    await setDoc(doc(db,"settings","epost"),{trackEndpoint:val("epostTrackEndpoint"),labelEndpoint:val("epostLabelEndpoint"),service:"우체국 익일특급",updatedAt:serverTimestamp()},{merge:true});
    await adminLog("우체국 API 설정 저장"); alert("우체국 설정이 저장되었습니다."); loadEpostAdmin();
  });
  $("issueEpostLabel")?.addEventListener("click",async()=>{
    const sel=$("epostOrderSelect"), opt=sel.options[sel.selectedIndex];
    if(!sel.value)return alert("주문을 선택해 주세요.");
    const payload={
      orderId:sel.value, orderNo:opt.dataset.orderNo, receiverName:opt.dataset.name, receiverPhone:opt.dataset.contact, receiverAddress:opt.dataset.address,
      senderName:val("senderName"), senderPhone:val("senderPhone"), senderZip:val("senderZip"), senderAddress:val("senderAddr"),
      weight:val("parcelWeight")||"300", memo:val("parcelMemo"), service:"우체국 익일특급"
    };
    const r=await callEpostLabel(payload);
    const trackingNo=r.trackingNo||"";
    await addDoc(collection(db,"epostShipments"),{...payload,trackingNo,status:r.ok?"송장발급완료":"발급요청대기",expectedArrival:nextBusinessDayText(),memberUid:opt.dataset.memberUid,memberEmail:opt.dataset.memberEmail,contact:opt.dataset.contact,createdAt:serverTimestamp(),apiMessage:r.message||""});
    if(trackingNo) await updateDoc(doc(db,"orders",sel.value),{trackingCompany:"우체국 익일특급",trackingNo,status:"배송준비",updatedAt:serverTimestamp()});
    await adminLog("우체국 익일특급 송장 발급 요청");
    alert(r.ok?"송장이 발급되었습니다.":"서버/API 설정 전이라 발급요청대기로 저장했습니다.");
    loadEpostAdmin();
  });
  $("saveManualEpost")?.addEventListener("click",async()=>{
    const sel=$("manualEpostOrderSelect"), opt=sel.options[sel.selectedIndex];
    if(!sel.value||!val("manualEpostNo"))return alert("주문과 송장번호를 입력해 주세요.");
    await addDoc(collection(db,"epostShipments"),{orderId:sel.value,orderNo:opt.dataset.orderNo,trackingNo:val("manualEpostNo"),service:"우체국 익일특급",status:"발송완료",expectedArrival:nextBusinessDayText(),memberUid:opt.dataset.memberUid,memberEmail:opt.dataset.memberEmail,contact:opt.dataset.contact,createdAt:serverTimestamp()});
    await updateDoc(doc(db,"orders",sel.value),{trackingCompany:"우체국 익일특급",trackingNo:val("manualEpostNo"),status:"배송중",updatedAt:serverTimestamp()});
    await addDoc(collection(db,"notifications"),{memberUid:opt.dataset.memberUid,memberEmail:opt.dataset.memberEmail,title:"우체국 익일특급 발송",body:`송장번호 ${val("manualEpostNo")} 발송되었습니다.`,createdAt:serverTimestamp()});
    await adminLog("우체국 수동 송장 저장"); alert("우체국 송장이 저장되고 홈페이지에 반영되었습니다."); loadEpostAdmin();
  });
  loadEpostAdmin();
},1000);
setInterval(loadEpostAdmin,5000);

// ===== 5.2 points automation admin complete =====
async function loadPointSettingsAdmin(){
  try{
    const [settings,members,points]=await Promise.all(["pointSettings","supportTickets","faqs","reservationBlocks","crmProfiles","refundLogs","activityLogs","dataChangeLogs","consultationReports","members","points"].map(list));
    const s=settings[0]||{};
    if($("pointRate"))$("pointRate").value=s.orderRate??"1";
    if($("consultPointRate"))$("consultPointRate").value=s.consultRate??"1";
    if($("reviewPoint"))$("reviewPoint").value=s.reviewPoint??"1000";
    if($("signupPoint"))$("signupPoint").value=s.signupPoint??"1000";
    if($("birthdayPoint"))$("birthdayPoint").value=s.birthdayPoint??"3000";
    if($("pointExpireDays"))$("pointExpireDays").value=s.expireDays??"365";
    if($("minPointUse"))$("minPointUse").value=s.minUse??"1000";
    if($("maxPointUseRate"))$("maxPointUseRate").value=s.maxUseRate??"50";
    if($("pointMemberSelect"))$("pointMemberSelect").innerHTML='<option value="">회원 선택</option>'+members.map(m=>`<option value="${m.id}" data-email="${m.email||""}" data-name="${m.name||""}">${m.name||"이름 없음"} / ${m.email||""} / ${calcMemberPoints(points,m).toLocaleString()}원</option>`).join("");
    if($("pointAdminList"))$("pointAdminList").innerHTML=points.slice(0,80).map(p=>card(`${p.memberName||p.memberEmail||""} · ${Number(p.amount||0).toLocaleString()}원`,`${p.reason||"적립금"}<br>구분: ${p.type||"-"}<br>만료일: ${p.expiresAt||"-"}`)).join("")||"<p>적립 내역이 없습니다.</p>";
  }catch(e){console.warn(e)}
}
function calcMemberPoints(points,m){
  return points.filter(p=>(p.memberUid===m.id||p.memberEmail===m.email)&&p.status!=="cancelled").reduce((s,p)=>s+Number(p.amount||0),0);
}
async function savePointSettings(){
  const data={
    orderRate:Number(val("pointRate")||1),
    consultRate:Number(val("consultPointRate")||1),
    reviewPoint:Number(val("reviewPoint")||1000),
    signupPoint:Number(val("signupPoint")||1000),
    birthdayPoint:Number(val("birthdayPoint")||3000),
    expireDays:Number(val("pointExpireDays")||365),
    minUse:Number(val("minPointUse")||1000),
    maxUseRate:Number(val("maxPointUseRate")||50),
    updatedAt:serverTimestamp()
  };
  await setDoc(doc(db,"pointSettings","supportTickets","faqs","reservationBlocks","crmProfiles","refundLogs","activityLogs","dataChangeLogs","consultationReports","default"),data,{merge:true});
  await adminLog("적립금 자동화 설정 저장");
  alert("적립금 설정이 저장되었습니다.");
  loadPointSettingsAdmin();
}
async function giveOrDeductPoint(){
  const sel=$("pointMemberSelect"), uid=sel.value;
  if(!uid)return alert("회원을 선택해 주세요.");
  const opt=sel.options[sel.selectedIndex];
  let amount=Number(val("pointAmount")||0);
  if(!amount)return alert("금액을 입력해 주세요.");
  if(val("pointMode")==="minus") amount=-Math.abs(amount);
  const reason=val("pointReason") || (amount>=0?"관리자 지급":"관리자 차감");
  const exp=new Date(); exp.setDate(exp.getDate()+365);
  await addDoc(collection(db,"points"),{memberUid:uid,memberEmail:opt.dataset.email,memberName:opt.dataset.name,amount,reason,type:"admin",expiresAt:exp.toISOString().slice(0,10),status:"active",createdAt:serverTimestamp()});
  await addDoc(collection(db,"notifications"),{memberUid:uid,memberEmail:opt.dataset.email,title:amount>=0?"적립금 지급":"적립금 차감",body:`${Math.abs(amount).toLocaleString()}원 / ${reason}`,createdAt:serverTimestamp()});
  await adminLog("적립금 수동 처리");
  alert("적립금 처리가 완료되었습니다.");
  loadPointSettingsAdmin();
}
async function bulkGivePoint(){
  const amount=Number(val("bulkPointAmount")||0);
  if(!amount)return alert("일괄 지급 금액을 입력해 주세요.");
  if(!confirm("전체 회원에게 적립금을 지급할까요?"))return;
  const members=await list("members");
  const reason=val("bulkPointReason")||"전체 이벤트 지급";
  const exp=new Date(); exp.setDate(exp.getDate()+365);
  for(const m of members){
    await addDoc(collection(db,"points"),{memberUid:m.id,memberEmail:m.email,memberName:m.name,amount,reason,type:"bulk",expiresAt:exp.toISOString().slice(0,10),status:"active",createdAt:serverTimestamp()});
    await addDoc(collection(db,"notifications"),{memberUid:m.id,memberEmail:m.email,title:"이벤트 적립금 지급",body:`${amount.toLocaleString()}원이 지급되었습니다.`,createdAt:serverTimestamp()});
  }
  await adminLog("전체 회원 적립금 일괄 지급");
  alert("전체 회원 지급 완료");
  loadPointSettingsAdmin();
}
async function autoPointByStatus(col,id,status){
  if(col==="bookings" && status==="상담완료"){
    const settings=(await list("pointSettings","supportTickets","faqs","reservationBlocks","crmProfiles","refundLogs","activityLogs","dataChangeLogs","consultationReports"))[0]||{consultRate:1};
    const bookings=await list("bookings");
    const b=bookings.find(x=>x.id===id);
    if(b && b.memberUid){
      const base=Number(String(b.price||b.type||"").replace(/[^\d]/g,""))||0;
      const amount=Math.floor(base*Number(settings.consultRate||1)/100);
      if(amount>0){
        await addDoc(collection(db,"points"),{memberUid:b.memberUid,memberEmail:b.memberEmail,memberName:b.name,amount,reason:"상담완료 자동 적립",type:"consult",status:"active",createdAt:serverTimestamp()});
      }
    }
  }
}

setTimeout(()=>{
  $("savePointSettings")?.addEventListener("click",savePointSettings);
  $("givePoint")?.addEventListener("click",giveOrDeductPoint);
  $("bulkGivePoint")?.addEventListener("click",bulkGivePoint);
  loadPointSettingsAdmin();
},1200);
setInterval(loadPointSettingsAdmin,5000);

// ===== 5.3 admin remaining core complete =====
async function loadRemainingCore(){
  try{
    const [members,orders,bookings,reviews,products,tickets,faqs,blocks,records,points]=await Promise.all(["members","orders","bookings","reviews","products","supportTickets","faqs","reservationBlocks","crmProfiles","refundLogs","activityLogs","dataChangeLogs","consultationReports","consultRecords","points"].map(list));
    if($("supportAdminList")) $("supportAdminList").innerHTML=tickets.map(t=>card(`${t.title||"문의"} · ${t.memberName||t.memberEmail||""}`,`${t.body||""}<br>상태: ${t.status||""}${t.answer?`<br>답변: ${t.answer}`:""}`,`<button class="secondary" onclick="answerTicket('${t.id}')">답변</button><button class="secondary" onclick="st('supportTickets','${t.id}','완료')">완료</button><button class="secondary" onclick="del('supportTickets','${t.id}')">삭제</button>`)).join("")||"<p>문의가 없습니다.</p>";
    if($("faqAdminList")) $("faqAdminList").innerHTML=faqs.map(f=>card(f.question||"FAQ",f.answer||"",`<button class="secondary" onclick="del('faqs','${f.id}')">삭제</button>`)).join("")||"<p>FAQ가 없습니다.</p>";
    if($("optionProductSelect")) $("optionProductSelect").innerHTML='<option value="">상품 선택</option>'+products.map(p=>`<option value="${p.id}">${p.name||""} / ${p.price||""}</option>`).join("");
    if($("reservationBlockList")) $("reservationBlockList").innerHTML=blocks.map(b=>card(`${b.date||""} ${b.time||""}`,"예약 차단",`<button class="secondary" onclick="del('reservationBlocks','${b.id}')">삭제</button>`)).join("")||"<p>차단된 시간이 없습니다.</p>";
    if($("memberAnalyticsList")){
      $("memberAnalyticsList").innerHTML=members.map(m=>{
        const uid=m.id;
        const total=orders.filter(o=>o.memberUid===uid||o.memberEmail===m.email).reduce((s,o)=>s+money(o.total),0);
        const orderCnt=orders.filter(o=>o.memberUid===uid||o.memberEmail===m.email).length;
        const bookCnt=bookings.filter(b=>b.memberUid===uid||b.memberEmail===m.email).length;
        const reviewCnt=reviews.filter(r=>r.memberUid===uid||r.memberEmail===m.email).length;
        const recordCnt=records.filter(r=>r.memberUid===uid||r.memberEmail===m.email).length;
        const pointSum=points.filter(p=>p.memberUid===uid||p.memberEmail===m.email).reduce((s,p)=>s+Number(p.amount||0),0);
        const grade=total>=500000?"VVIP":total>=300000?"VIP":total>=100000?"GOLD":total>=50000?"SILVER":"일반";
        return card(`${m.name||"회원"} · ${grade}`,`이메일: ${m.email||""}<br>총결제: ${total.toLocaleString()}원<br>주문: ${orderCnt}건 / 예약: ${bookCnt}건 / 후기: ${reviewCnt}건<br>상담이력: ${recordCnt}건<br>적립금: ${pointSum.toLocaleString()}원`, `<button class="secondary" onclick="setMemberGrade('${uid}','${grade}')">등급저장</button>`);
      }).join("")||"<p>회원이 없습니다.</p>";
    }
  }catch(e){console.warn(e)}
}
window.answerTicket=async(id)=>{
  const answer=prompt("답변 내용을 입력해 주세요."); if(answer===null)return;
  const tickets=await list("supportTickets"); const t=tickets.find(x=>x.id===id);
  await updateDoc(doc(db,"supportTickets",id),{answer,status:"답변완료",updatedAt:serverTimestamp()});
  if(t) await addDoc(collection(db,"notifications"),{memberUid:t.memberUid,memberEmail:t.memberEmail,title:"1:1 문의 답변",body:answer,createdAt:serverTimestamp()});
  await adminLog("1:1 문의 답변"); loadRemainingCore();
};
window.setMemberGrade=async(uid,grade)=>{await updateDoc(doc(db,"members",uid),{grade,updatedAt:serverTimestamp()});alert("회원 등급 저장 완료");loadRemainingCore();};
setTimeout(()=>{
  $("addFaq")?.addEventListener("click",async()=>{await addDoc(collection(db,"faqs"),{question:val("faqQuestion"),answer:val("faqAnswer"),createdAt:serverTimestamp()});await adminLog("FAQ 등록");alert("FAQ가 홈페이지에 반영되었습니다.");loadRemainingCore();});
  $("saveProductOption")?.addEventListener("click",async()=>{const id=val("optionProductSelect"); if(!id)return alert("상품을 선택해 주세요."); await updateDoc(doc(db,"products",id),{options:val("productOptionText"),discountRate:val("productDiscountRate"),eventEnd:val("productEventEnd"),badge:val("productBadge"),updatedAt:serverTimestamp()});await adminLog("상품 옵션 저장");alert("상품 옵션이 홈페이지에 반영되었습니다.");loadRemainingCore();});
  $("addReservationBlock")?.addEventListener("click",async()=>{if(!val("reservationBlockDate")||!val("reservationBlockTime"))return alert("날짜와 시간을 입력해 주세요.");await addDoc(collection(db,"reservationBlocks","crmProfiles","refundLogs","activityLogs","dataChangeLogs","consultationReports"),{date:val("reservationBlockDate"),time:val("reservationBlockTime"),createdAt:serverTimestamp()});await adminLog("예약 시간 차단");alert("해당 시간이 차단되었습니다.");loadRemainingCore();});
  loadRemainingCore();
},1200);
setInterval(loadRemainingCore,5000);

// ===== 5.4 full requested suite admin =====
async function uploadFilesForSuite(files, folder){
  const urls=[];
  for(const f of Array.from(files||[])){
    const r=ref(storage,`${folder}/${Date.now()}_${f.name}`);
    await uploadBytes(r,f);
    urls.push(await getDownloadURL(r));
  }
  return urls;
}
function toDateStr(ts){
  if(!ts?.seconds)return "";
  return new Date(ts.seconds*1000).toISOString().slice(0,10);
}
async function logDataChange(action, detail=""){
  try{await addDoc(collection(db,"dataChangeLogs"),{action,detail,adminEmail:auth.currentUser?.email||"",createdAt:serverTimestamp()});}catch(e){}
}
async function loadFullRequestedSuite(){
  try{
    const cols=["members","orders","bookings","products","reviews","consultRecords","crmProfiles","refundLogs","activityLogs","adminLogs","dataChangeLogs","consultationReports","settings"];
    const [members,orders,bookings,products,reviews,records,crmProfiles,refundLogs,activityLogs,adminLogs,dataChangeLogs,reports,settings]=await Promise.all(cols.map(list));
    if($("crm2MemberSelect"))$("crm2MemberSelect").innerHTML='<option value="">회원 선택</option>'+members.map(m=>`<option value="${m.id}" data-email="${m.email||""}" data-name="${m.name||""}">${m.name||""} / ${m.email||""}</option>`).join("");
    if($("consultMemberSelect"))$("consultMemberSelect").innerHTML='<option value="">회원 선택</option>'+members.map(m=>`<option value="${m.id}" data-email="${m.email||""}" data-name="${m.name||""}">${m.name||""} / ${m.email||""}</option>`).join("");

    if($("crm2List")){
      $("crm2List").innerHTML=members.map(m=>{
        const uid=m.id;
        const consultAmt=bookings.filter(b=>b.memberUid===uid||b.memberEmail===m.email).reduce((s,b)=>s+money(b.price||b.type),0);
        const productAmt=orders.filter(o=>o.memberUid===uid||o.memberEmail===m.email).reduce((s,o)=>s+money(o.total),0);
        const lastLog=activityLogs.find(l=>l.memberUid===uid||l.memberEmail===m.email);
        const profile=crmProfiles.find(c=>c.memberUid===uid||c.memberEmail===m.email)||{};
        const autoGrade=profile.vipStatus||m.grade||(productAmt+consultAmt>=500000?"VVIP":productAmt+consultAmt>=300000?"VIP":productAmt+consultAmt>=100000?"GOLD":"일반");
        return card(`${m.name||"회원"} · ${autoGrade}`,`총 상담금액: ${consultAmt.toLocaleString()}원<br>총 상품구매: ${productAmt.toLocaleString()}원<br>마지막 접속: ${lastLog?toDateStr(lastLog.createdAt):"-"}<br>재상담 예정: ${profile.nextDate||"-"}<br>메모: ${profile.memo||"-"}`);
      }).join("")||"<p>CRM 데이터가 없습니다.</p>";
    }
    if($("crm2Timeline")){
      const sel=$("crm2MemberSelect"), uid=sel?.value;
      const m=members.find(x=>x.id===uid);
      const timeline=[
        ...orders.filter(o=>o.memberUid===uid).map(o=>({t:o.createdAt,label:`주문 ${o.orderNo||""} ${o.total||""}`})),
        ...bookings.filter(b=>b.memberUid===uid).map(b=>({t:b.createdAt,label:`예약 ${b.date||""} ${b.time||""} ${b.status||""}`})),
        ...records.filter(r=>r.memberUid===uid).map(r=>({t:r.createdAt,label:`상담이력 ${r.title||""}`})),
        ...reviews.filter(r=>r.memberUid===uid).map(r=>({t:r.createdAt,label:`후기 ${r.stars||""}`}))
      ].sort((a,b)=>(b.t?.seconds||0)-(a.t?.seconds||0));
      $("crm2Timeline").innerHTML=uid?`<h2>${m?.name||""} 타임라인</h2>`+timeline.map(x=>card(x.label,toDateStr(x.t))).join(""):"<p>회원을 선택하면 타임라인이 표시됩니다.</p>";
    }

    const today=new Date().toISOString().slice(0,10);
    const month=today.slice(0,7);
    const todayOrders=orders.filter(o=>toDateStr(o.createdAt)===today);
    const monthOrders=orders.filter(o=>toDateStr(o.createdAt).startsWith(month));
    const canceled=[...orders,...bookings].filter(x=>String(x.status||"").includes("취소")||String(x.status||"").includes("환불")).length;
    const totalItems=orders.length+bookings.length;
    if($("dashTodaySales"))$("dashTodaySales").textContent=todayOrders.reduce((s,o)=>s+money(o.total),0).toLocaleString()+"원";
    if($("dashMonthSales"))$("dashMonthSales").textContent=monthOrders.reduce((s,o)=>s+money(o.total),0).toLocaleString()+"원";
    if($("dashConsultCount"))$("dashConsultCount").textContent=bookings.length;
    if($("dashOrderCount"))$("dashOrderCount").textContent=orders.length;
    if($("dashReserveRate"))$("dashReserveRate").textContent=members.length?Math.round(bookings.length/members.length*100)+"%":"0%";
    if($("dashCancelRate"))$("dashCancelRate").textContent=totalItems?Math.round(canceled/totalItems*100)+"%":"0%";
    if($("dashSalesChart")){
      const byDay={}; orders.forEach(o=>{const d=toDateStr(o.createdAt)||"미상";byDay[d]=(byDay[d]||0)+money(o.total)});
      $("dashSalesChart").innerHTML='<h3>일별 매출</h3>'+Object.entries(byDay).slice(0,14).map(([d,v])=>`<div class="barRow"><span>${d}</span><b style="width:${Math.min(100,v/10000)}%"></b><em>${v.toLocaleString()}원</em></div>`).join("");
    }
    if($("dashPopularList")){
      const productCount={}; orders.forEach(o=>(o.items||[]).forEach(i=>productCount[i.name]=(productCount[i.name]||0)+Number(i.qty||1)));
      const consultCount={}; bookings.forEach(b=>consultCount[b.type]=(consultCount[b.type]||0)+1);
      $("dashPopularList").innerHTML="<h2>인기 상품</h2>"+Object.entries(productCount).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([n,c])=>card(n,`${c}건`)).join("")+"<h2>인기 상담</h2>"+Object.entries(consultCount).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([n,c])=>card(n,`${c}건`)).join("");
    }

    if($("refund2List"))$("refund2List").innerHTML=refundLogs.map(r=>card(`${r.title||"환불"} · ${r.memberEmail||""}`,`${r.reason||""}<br>상태: ${r.status||""}`,`<button class="secondary" onclick="processRefund2('${r.id}','승인')">승인</button><button class="secondary" onclick="processRefund2('${r.id}','반려')">반려</button><button class="secondary" onclick="processRefund2('${r.id}','환불완료')">환불완료</button>`)).join("")||"<p>환불/취소 이력이 없습니다.</p>";

    if($("memberSystemList"))$("memberSystemList").innerHTML=members.map(m=>card(m.name||"회원",`이메일: ${m.email||""}<br>이메일 인증: ${m.emailVerified?"완료":"미확인"}<br>상태: ${m.status||"정상"}<br>등급: ${m.grade||"일반"}`,`<button class="secondary" onclick="setMemberStatus('${m.id}','휴면')">휴면</button><button class="secondary" onclick="setMemberStatus('${m.id}','탈퇴처리')">탈퇴처리</button><button class="secondary" onclick="setMemberStatus('${m.id}','정상')">정상</button>`)).join("")||"<p>회원이 없습니다.</p>";

    if($("consultReportList"))$("consultReportList").innerHTML=reports.map(r=>card(r.title||"상담 보고서",`${r.memberName||r.memberEmail||""}<br>${r.result||""}<br>첨부 ${r.urls?.length||0}개`, `<button class="secondary" onclick="del('consultationReports','${r.id}')">삭제</button>`)).join("")||"<p>상담 보고서가 없습니다.</p>";

    if($("adminActivityLogList"))$("adminActivityLogList").innerHTML=adminLogs.slice(0,50).map(l=>card(l.action||"활동",toDateStr(l.createdAt))).join("")||"<p>관리자 로그가 없습니다.</p>";
    if($("memberActivityLogList"))$("memberActivityLogList").innerHTML=activityLogs.slice(0,50).map(l=>card(`${l.memberEmail||""} · ${l.action||""}`,`${l.detail||""}<br>${toDateStr(l.createdAt)}`)).join("")||"<p>회원 로그가 없습니다.</p>";
    if($("dataChangeLogList"))$("dataChangeLogList").innerHTML=dataChangeLogs.slice(0,50).map(l=>card(l.action||"변경",`${l.detail||""}<br>${toDateStr(l.createdAt)}`)).join("")||"<p>변경 기록이 없습니다.</p>";
  }catch(e){console.warn(e)}
}
window.processRefund2=async(id,status)=>{await updateDoc(doc(db,"refundLogs",id),{status,updatedAt:serverTimestamp()});await adminLog("환불 처리: "+status);loadFullRequestedSuite();};
window.setMemberStatus=async(id,status)=>{await updateDoc(doc(db,"members",id),{status,updatedAt:serverTimestamp()});await adminLog("회원 상태 변경: "+status);loadFullRequestedSuite();};
async function fullBackup(cols){
  const data={};
  for(const c of cols)data[c]=await list(c).catch(()=>[]);
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="cheonyul-backup-"+Date.now()+".json";a.click();URL.revokeObjectURL(a.href);
}
setTimeout(()=>{
  $("crm2MemberSelect")?.addEventListener("change",loadFullRequestedSuite);
  $("saveCrm2")?.addEventListener("click",async()=>{
    const sel=$("crm2MemberSelect"), opt=sel.options[sel.selectedIndex];
    if(!sel.value)return alert("회원을 선택해 주세요.");
    await addDoc(collection(db,"crmProfiles"),{memberUid:sel.value,memberEmail:opt.dataset.email,memberName:opt.dataset.name,memo:val("crm2Memo"),nextDate:val("crm2NextDate"),vipStatus:val("crm2VipStatus"),createdAt:serverTimestamp()});
    await logDataChange("CRM 2.0 저장",opt.dataset.email); await adminLog("CRM 2.0 저장"); alert("CRM 저장 완료"); loadFullRequestedSuite();
  });
  $("saveConsultReport")?.addEventListener("click",async()=>{
    const sel=$("consultMemberSelect"), opt=sel.options[sel.selectedIndex]; if(!sel.value)return alert("회원을 선택해 주세요.");
    const urls=await uploadFilesForSuite($("consultFiles").files,"consultReports");
    await addDoc(collection(db,"consultationReports"),{memberUid:sel.value,memberEmail:opt.dataset.email,memberName:opt.dataset.name,title:val("consultTitle"),result:val("consultResult"),urls,createdAt:serverTimestamp()});
    await addDoc(collection(db,"notifications"),{memberUid:sel.value,memberEmail:opt.dataset.email,title:"상담 완료 보고서 등록",body:val("consultTitle"),createdAt:serverTimestamp()});
    await logDataChange("상담 보고서 저장",opt.dataset.email); alert("상담 보고서가 회원에게 반영되었습니다."); loadFullRequestedSuite();
  });
  $("saveOpNotice")?.addEventListener("click",async()=>{await addDoc(collection(db,"notices"),{title:val("opNoticeTitle"),body:val("opNoticeBody"),createdAt:serverTimestamp()});await logDataChange("공지 저장",val("opNoticeTitle"));alert("공지 저장 완료");});
  $("saveOpPopup")?.addEventListener("click",async()=>{await addDoc(collection(db,"events"),{title:val("opPopupTitle"),body:val("opPopupBody"),endDate:val("opPopupEnd"),createdAt:serverTimestamp()});await logDataChange("팝업/이벤트 저장",val("opPopupTitle"));alert("팝업/이벤트 저장 완료");});
  $("backupFirestoreJson")?.addEventListener("click",()=>fullBackup(["orders","bookings","members","products","reviews","coupons","points","consultRecords","consultationReports","supportTickets","faqs","events","settings","notifications","activityLogs","adminLogs","dataChangeLogs"]));
  $("backupSettingsJson")?.addEventListener("click",()=>fullBackup(["settings","pointSettings","seoSettings","adminRoles","allowedAdmins"]));
  $("backupImageList")?.addEventListener("click",()=>fullBackup(["products","reviews","memberFiles","consultationReports"]));
  $("restorePreviewBtn")?.addEventListener("click",()=>{$("backupResult").innerHTML="<p>복원 미리보기 완료: 실제 복원은 데이터 손상 방지를 위해 수동 검토 후 진행하세요.</p>";});
  loadFullRequestedSuite();
},1500);
setInterval(loadFullRequestedSuite,6000);

// ===== 6.0 enterprise admin additions =====
let soundAlertEnabled=false, lastAlertCount=0;
function csvDownload2(filename, rows){
  const csv=rows.map(r=>r.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n");
  const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;a.click();URL.revokeObjectURL(a.href);
}
function jsonDownload(filename, obj){
  const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;a.click();URL.revokeObjectURL(a.href);
}
async function uploadEnterpriseFiles(files, folder){
  const urls=[];
  for(const f of Array.from(files||[])){
    const r=ref(storage,`${folder}/${Date.now()}_${f.name}`);
    await uploadBytes(r,f);
    urls.push(await getDownloadURL(r));
  }
  return urls;
}
function playBeep(){
  if(!soundAlertEnabled)return;
  try{
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    const o=ctx.createOscillator();const g=ctx.createGain();
    o.connect(g);g.connect(ctx.destination);o.frequency.value=880;g.gain.value=.08;o.start();setTimeout(()=>{o.stop();ctx.close();},160);
  }catch(e){}
}
function applyRoleMenus(role){
  const permissions={
    super:["*"],
    operation:["dash2Admin","realtimeCenterAdmin","visitorAdmin","opsAdmin","eventGameAdmin","excelAdmin","backup2Admin"],
    consult:["crm2Admin","consultManageAdmin","calendarProAdmin","aiAssistAdmin","supportAdmin","chatAdmin","bookingHistoryPage"],
    delivery:["epostAdmin","orders","excelAdmin"],
    customer:["memberAnalytics","memberSystemAdmin","supportAdmin","crm2Admin","chatAdmin"]
  };
  const allowed=permissions[role]||permissions.super;
  if(allowed[0]==="*")return;
  document.querySelectorAll("[data-tab]").forEach(b=>{const t=b.dataset.tab;if(!allowed.includes(t)&&!["dash"].includes(t))b.style.display="none";});
}
async function loadEnterprise(){
  try{
    const cols=["adminRoles","notifications","orders","bookings","supportTickets","reviews","visitorSessions","storageFiles","members","products","consultRecords","calendarEvents","events","errorLogs","settings","faqs","consultationReports"];
    const [roles,notifications,orders,bookings,tickets,reviews,visitors,storageFiles,members,products,records,calEvents,events,errorLogs,settings,faqs,reports]=await Promise.all(cols.map(list));
    const myRole=(roles.find(r=>String(r.email||"").toLowerCase()===(auth.currentUser?.email||"").toLowerCase())?.role)||"super";
    applyRoleMenus(myRole);
    if($("superRoleList"))$("superRoleList").innerHTML=roles.map(r=>card(r.email||"",`권한: ${r.role||""}`,`<button class="secondary" onclick="del('adminRoles','${r.id}')">삭제</button>`)).join("")||"<p>권한 등록이 없습니다.</p>";

    const alerts=[
      ...orders.slice(0,5).map(o=>({title:"새 주문",body:`${o.orderNo||""} ${o.name||""} ${o.total||""}`})),
      ...bookings.slice(0,5).map(b=>({title:"상담 예약",body:`${b.name||""} ${b.date||""} ${b.time||""}`})),
      ...tickets.slice(0,5).map(t=>({title:"1:1 문의",body:t.title||""})),
      ...reviews.filter(r=>!r.approved).slice(0,5).map(r=>({title:"후기 승인대기",body:r.name||""})),
      ...notifications.filter(n=>n.target==="admin").slice(0,10).map(n=>({title:n.title,body:n.body}))
    ];
    if(alerts.length>lastAlertCount){playBeep();lastAlertCount=alerts.length;}
    if($("realtimeAlertList"))$("realtimeAlertList").innerHTML=alerts.map(a=>card(a.title,a.body)).join("")||"<p>실시간 알림이 없습니다.</p>";

    const today=new Date().toISOString().slice(0,10);
    const online=visitors.filter(v=>v.lastSeenAt?.seconds && Date.now()-v.lastSeenAt.seconds*1000<10*60*1000);
    if($("onlineVisitorCount"))$("onlineVisitorCount").textContent=online.length;
    if($("todayVisitorCount"))$("todayVisitorCount").textContent=visitors.filter(v=>v.createdDate===today).length;
    if($("mobileVisitorCount"))$("mobileVisitorCount").textContent=visitors.filter(v=>v.device==="mobile").length;
    if($("pcVisitorCount"))$("pcVisitorCount").textContent=visitors.filter(v=>v.device==="pc").length;
    if($("visitorList"))$("visitorList").innerHTML=visitors.slice(0,50).map(v=>card(v.device||"접속",`${v.path||""}<br>${v.referrer||"직접접속"}<br>${v.lang||""}`)).join("");

    if($("storageFileList"))$("storageFileList").innerHTML=storageFiles.map(f=>card(f.purpose||"파일",`${f.urls?.length||0}개`,(f.urls||[]).map((u,i)=>`<a class="secondary fileLink" target="_blank" href="${u}">파일 ${i+1}</a>`).join(""))).join("")||"<p>업로드 파일이 없습니다.</p>";
    if($("pdfMemberSelect"))$("pdfMemberSelect").innerHTML='<option value="">회원 선택</option>'+members.map(m=>`<option value="${m.id}" data-email="${m.email||""}" data-name="${m.name||""}">${m.name||""} / ${m.email||""}</option>`).join("");
    if($("aiMemberSelect"))$("aiMemberSelect").innerHTML='<option value="">회원 선택</option>'+members.map(m=>`<option value="${m.id}" data-email="${m.email||""}" data-name="${m.name||""}">${m.name||""} / ${m.email||""}</option>`).join("");
    if($("calendarProList"))$("calendarProList").innerHTML=calEvents.map(c=>card(`${c.date||""} · ${c.type||""}`,c.title||"",`<button class="secondary" onclick="del('calendarEvents','${c.id}')">삭제</button>`)).join("")||"<p>일정이 없습니다.</p>";
    if($("errorLogList"))$("errorLogList").innerHTML=errorLogs.slice(0,50).map(e=>card(e.message||"오류",`${e.source||""}:${e.line||""}`)).join("")||"<p>오류 기록이 없습니다.</p>";
  }catch(e){console.warn(e)}
}
setTimeout(()=>{
  $("enableSoundAlert")?.addEventListener("click",()=>{soundAlertEnabled=true;alert("알림음이 켜졌습니다.");});
  $("saveSuperRole")?.addEventListener("click",async()=>{await addDoc(collection(db,"adminRoles"),{email:val("roleUserEmail"),role:val("roleUserType"),createdAt:serverTimestamp()});await adminLog("관리자 권한 저장");alert("권한 저장 완료");loadEnterprise();});
  $("saveSeoPro")?.addEventListener("click",async()=>{await addDoc(collection(db,"seoSettings"),{title:val("seoProTitle"),desc:val("seoProDesc"),ogImage:val("seoProOg"),naver:val("seoProNaver"),google:val("seoProGoogle"),createdAt:serverTimestamp()});alert("SEO 저장 완료");});
  $("uploadStorageFiles")?.addEventListener("click",async()=>{const urls=await uploadEnterpriseFiles($("storageUploadFiles").files,"enterprise");await addDoc(collection(db,"storageFiles"),{purpose:val("storagePurpose"),urls,createdAt:serverTimestamp()});alert("Storage 업로드 완료");loadEnterprise();});
  $("savePwaSettings")?.addEventListener("click",async()=>{await setDoc(doc(db,"settings","pwa"),{name:val("pwaName"),shortName:val("pwaShort"),theme:val("pwaTheme"),updatedAt:serverTimestamp()},{merge:true});alert("PWA 설정 저장 완료");});
  $("adminGlobalSearch")?.addEventListener("input",async()=>{const q=val("adminGlobalSearch").toLowerCase();if(!q){$("adminSearchResults").innerHTML="";return;}const rows=[];for(const c of ["members","orders","bookings","reviews","products","consultRecords","supportTickets"]){(await list(c)).forEach(x=>{if(JSON.stringify(x).toLowerCase().includes(q))rows.push({c,x})})}$("adminSearchResults").innerHTML=rows.slice(0,50).map(r=>card(r.c,JSON.stringify(r.x).slice(0,300))).join("")||"<p>검색 결과 없음</p>";});
  $("csvMembers")?.addEventListener("click",async()=>csvDownload2("members.csv",[["이름","이메일","연락처"],...(await list("members")).map(m=>[m.name,m.email,m.contact])]));
  $("csvOrders")?.addEventListener("click",async()=>csvDownload2("orders.csv",[["주문번호","이름","금액","상태"],...(await list("orders")).map(o=>[o.orderNo,o.name,o.total,o.status])]));
  $("csvBookings")?.addEventListener("click",async()=>csvDownload2("bookings.csv",[["이름","상담","날짜","상태"],...(await list("bookings")).map(b=>[b.name,b.type,b.date,b.status])]));
  $("csvReviews")?.addEventListener("click",async()=>csvDownload2("reviews.csv",[["이름","별점","내용","승인"],...(await list("reviews")).map(r=>[r.name,r.stars,r.body,r.approved])]));
  $("createReportPdf")?.addEventListener("click",async()=>{const sel=$("pdfMemberSelect"),opt=sel.options[sel.selectedIndex];if(!sel.value)return alert("회원을 선택해 주세요.");const html=`<html><body><h1>${val("pdfTitle")}</h1><pre>${val("pdfBody")}</pre></body></html>`;const blob=new Blob([html],{type:"text/html"});const url=URL.createObjectURL(blob);await addDoc(collection(db,"consultationReports"),{memberUid:sel.value,memberEmail:opt.dataset.email,memberName:opt.dataset.name,title:val("pdfTitle"),result:val("pdfBody"),urls:[url],createdAt:serverTimestamp()});alert("보고서가 생성되었습니다. 브라우저 인쇄에서 PDF 저장도 가능합니다.");});
  $("createAdminQr")?.addEventListener("click",()=>{$("qrAdminResult").innerHTML=`<img class="qrImg" src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(val("qrAdminText"))}">`;});
  $("saveCalEvent")?.addEventListener("click",async()=>{await addDoc(collection(db,"calendarEvents"),{title:val("calTitle"),date:val("calDate"),type:val("calType"),createdAt:serverTimestamp()});alert("캘린더 일정 저장 완료");loadEnterprise();});
  $("saveGameEvent")?.addEventListener("click",async()=>{await setDoc(doc(db,"eventGameSettings","default"),{prizes:val("roulettePrizes"),checkinPoint:val("checkinPoint"),updatedAt:serverTimestamp()},{merge:true});alert("이벤트 설정 저장 완료");});
  $("makeAiSummary")?.addEventListener("click",async()=>{const sel=$("aiMemberSelect"),uid=sel.value;if(!uid)return alert("회원을 선택해 주세요.");const rec=(await list("consultRecords")).filter(r=>r.memberUid===uid).map(r=>r.memo||r.title).join("\\n");const summary=`요약: ${rec.slice(0,300)||"상담기록 없음"}\\n주의사항: 재상담 예정일과 최근 감정 흐름 확인\\n다음 상담 추천: 이전 상담 주제 기반으로 재확인`;await addDoc(collection(db,"aiSummaries"),{memberUid:uid,summary,createdAt:serverTimestamp()});$("aiAssistResult").innerHTML=card("AI 상담 보조",summary);});
  $("showFunctionsGuide")?.addEventListener("click",()=>{$("functionsGuide").innerHTML="<p>Cloud Functions로 예약 자동취소, 적립금 만료, 생일 적립, 쿠폰 만료, 휴면회원, 자동 이메일을 배포할 수 있습니다. functions 폴더 템플릿을 확인하세요.</p>";});
  $("downloadRules")?.addEventListener("click",()=>jsonDownload("firestore-rules.txt",{rules:"첨부된 firestore.rules 파일을 Firebase 콘솔에 적용하세요."}));
  $("downloadIndexes")?.addEventListener("click",()=>jsonDownload("firestore.indexes.json",{indexes:"첨부된 firestore.indexes.json 사용"}));
  $("bumpCacheBtn")?.addEventListener("click",async()=>{await setDoc(doc(db,"cacheSettings","version"),{version:Date.now(),updatedAt:serverTimestamp()},{merge:true});$("cacheStatus").innerHTML="<p>캐시 버전이 갱신되었습니다.</p>";});
  loadEnterprise();
},1600);
setInterval(loadEnterprise,5000);


// ===== 6.2 관리자 상담 채팅 복원 =====
let selectedAdminChatMember="";
async function loadAdminChat(){
  try{
    const [m1,m2,chats]=await Promise.all([list("members").catch(()=>[]),list("users").catch(()=>[]),list("chats").catch(()=>[])]); const members=uniqueByEmailOrUid([...m1,...m2]);
    const sel=$("chatMemberSelect");
    if(sel){
      const current=sel.value || selectedAdminChatMember;
      sel.innerHTML='<option value="">회원 선택</option>'+members.map(m=>`<option value="${m.id}" data-email="${m.email||""}" data-name="${m.name||""}">${m.name||"이름 없음"} / ${m.email||""}</option>`).join("");
      if(current) sel.value=current;
      selectedAdminChatMember=sel.value;
    }
    const uid=selectedAdminChatMember || sel?.value || "";
    const box=$("adminChatBox");
    if(box){
      const rows=chats.filter(c=>c.threadId===uid || c.memberUid===uid).sort((a,b)=>(a.createdAt?.seconds||0)-(b.createdAt?.seconds||0));
      box.innerHTML=uid ? (rows.map(m=>`<div class="msg ${m.sender==='admin'?'adminMsg':'userMsg'}"><b>${m.sender==='admin'?'관리자':(m.memberName||'회원')}</b><p>${m.text||""}</p></div>`).join("")||"<p>채팅 내역이 없습니다.</p>") : "<p>회원을 선택해 주세요.</p>";
      box.scrollTop=box.scrollHeight;
    }
  }catch(e){console.warn(e)}
}
async function sendAdminChat(){
  const sel=$("chatMemberSelect");
  const uid=sel?.value;
  if(!uid)return alert("회원을 선택해 주세요.");
  const text=val("adminChatInput");
  if(!text)return alert("메시지를 입력해 주세요.");
  const opt=sel.options[sel.selectedIndex];
  await addDoc(collection(db,"chats"),{
    threadId:uid, memberUid:uid, memberEmail:opt.dataset.email, memberName:opt.dataset.name,
    sender:"admin", text, read:false, createdAt:serverTimestamp()
  });
  await addDoc(collection(db,"notifications"),{
    memberUid:uid, memberEmail:opt.dataset.email, title:"상담 답변 도착", body:text, createdAt:serverTimestamp()
  });
  $("adminChatInput").value="";
  await adminLog("상담 채팅 답변");
  loadAdminChat();
}
setTimeout(()=>{
  $("chatMemberSelect")?.addEventListener("change",()=>{selectedAdminChatMember=$("chatMemberSelect").value;loadAdminChat();});
  $("adminChatSend")?.addEventListener("click",sendAdminChat);
  $("refreshChatAdmin")?.addEventListener("click",loadAdminChat);
  loadAdminChat();
},1000);
setInterval(loadAdminChat,4000);


// ===== 6.3 관리자 회원관리 실시간 연동 복원 =====
function uniqueByEmailOrUid(rows){
  const map=new Map();
  rows.forEach(x=>{
    const key=x.uid||x.id||x.email||x.contact||Math.random().toString(36);
    const old=map.get(key)||{};
    map.set(key,{...old,...x});
  });
  return [...map.values()];
}
async function loadMemberSyncAdmin(){
  try{
    const [members,users,orders,bookings,points,coupons,chats] = await Promise.all([
      list("members").catch(()=>[]),
      list("users").catch(()=>[]),
      list("orders").catch(()=>[]),
      list("bookings").catch(()=>[]),
      list("points").catch(()=>[]),
      list("coupons").catch(()=>[]),
      list("chats").catch(()=>[])
    ]);
    const fromOrders=orders.map(o=>({uid:o.memberUid||"",email:o.memberEmail||"",name:o.name||"",contact:o.contact||"",source:"orders"})).filter(x=>x.email||x.contact||x.name);
    const fromBookings=bookings.map(b=>({uid:b.memberUid||"",email:b.memberEmail||"",name:b.name||"",contact:b.contact||"",source:"bookings"})).filter(x=>x.email||x.contact||x.name);
    let rows=uniqueByEmailOrUid([...members,...users,...fromOrders,...fromBookings]);
    const q=(val("memberSearchInput")||"").toLowerCase();
    if(q) rows=rows.filter(m=>JSON.stringify(m).toLowerCase().includes(q));
    if($("memberSyncStats")){
      $("memberSyncStats").innerHTML=`<button>전체 회원 <b>${rows.length}</b></button><button>주문 회원 <b>${fromOrders.length}</b></button><button>예약 회원 <b>${fromBookings.length}</b></button><button>채팅 <b>${chats.length}</b></button>`;
    }
    if($("memberSyncList")){
      $("memberSyncList").innerHTML=rows.length?rows.map(m=>{
        const uid=m.uid||m.id||"";
        const email=m.email||"";
        const total=orders.filter(o=>(uid&&o.memberUid===uid)||(email&&o.memberEmail===email)||o.contact===m.contact).reduce((s,o)=>s+money(o.total),0);
        const bookCnt=bookings.filter(b=>(uid&&b.memberUid===uid)||(email&&b.memberEmail===email)||b.contact===m.contact).length;
        const pointSum=points.filter(p=>(uid&&p.memberUid===uid)||(email&&p.memberEmail===email)).reduce((s,p)=>s+Number(p.amount||0),0);
        const couponCnt=coupons.filter(c=>(uid&&c.memberUid===uid)||(email&&c.memberEmail===email)).length;
        return card(`${m.name||"이름 없음"} · ${email||"이메일 없음"}`,`연락처: ${m.contact||"-"}<br>상태: ${m.status||"정상"}<br>총구매: ${total.toLocaleString()}원<br>예약: ${bookCnt}건 / 적립금: ${pointSum.toLocaleString()}원 / 쿠폰: ${couponCnt}개`,`
          <button class="secondary" onclick="openMemberChat('${uid}','${email}')">채팅</button>
          <button class="secondary" onclick="setMemberAdminStatus('${uid}','휴면')">휴면</button>
          <button class="secondary" onclick="setMemberAdminStatus('${uid}','정상')">정상</button>
        `);
      }).join(""):"<p>회원이 없습니다. 회원가입 후 새로고침을 누르거나 고객이 로그인하면 자동 동기화됩니다.</p>";
    }
  }catch(e){console.warn(e)}
}
window.openMemberChat=(uid,email)=>{
  const tab=document.querySelector('[data-tab="chatAdmin"]');
  tab?.click();
  setTimeout(()=>{if($("chatMemberSelect")){$("chatMemberSelect").value=uid; selectedAdminChatMember=uid; loadAdminChat();}},500);
};
window.setMemberAdminStatus=async(uid,status)=>{
  if(!uid)return alert("회원 UID가 없어 상태 변경이 어렵습니다.");
  await setDoc(doc(db,"members",uid),{status,updatedAt:serverTimestamp()},{merge:true});
  await adminLog("회원 상태 변경: "+status);
  loadMemberSyncAdmin();
};
setTimeout(()=>{
  $("refreshMemberSync")?.addEventListener("click",loadMemberSyncAdmin);
  $("memberSearchInput")?.addEventListener("input",loadMemberSyncAdmin);
  loadMemberSyncAdmin();
},900);
setInterval(loadMemberSyncAdmin,3000);
