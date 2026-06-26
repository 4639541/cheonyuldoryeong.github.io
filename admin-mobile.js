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

window.st = async(c,id,s)=>{await updateDoc(doc(db,c,id),{status:s,updatedAt:serverTimestamp()});await adminLog(`${c} 상태 변경: ${s}`);load();};
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

["orders","bookings","members","coupons","products","consultPrices","settings","visits","adminLogs","banners","benefits","consultRecords","spiritualRequests","allowedAdmins"].forEach(c=>{
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
window.approveReview=async(id,approved)=>{await updateDoc(doc(db,"reviews",id),{approved,updatedAt:serverTimestamp()});await adminLog(approved?"후기 승인":"후기 승인취소");load();};
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
    const rows=await list("allowedAdmins");
    const current=auth.currentUser?.email||"";
    if(!rows.length && current){
      await addDoc(collection(db,"allowedAdmins"),{email:current,createdAt:serverTimestamp()});
      return true;
    }
    return rows.some(a=>String(a.email||"").toLowerCase()===current.toLowerCase());
  }catch(e){return true;}
}
async function loadOps(){
  try{
    const [members,records,spirituals,orders,bookings,allowed] = await Promise.all(["members","consultRecords","spiritualRequests","orders","bookings","allowedAdmins"].map(list));
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
    await addDoc(collection(db,"allowedAdmins"),{email:val("allowedAdminEmail"),createdAt:serverTimestamp()});
    await adminLog("관리자 이메일 허용"); alert("허용 관리자 추가 완료"); loadOps();
  });
  loadOps();
},900);
setInterval(loadOps,4000);
