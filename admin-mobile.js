import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
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

function bind(){
  document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>goTab(b.dataset.tab));

  $("adminLogin")?.addEventListener("click", adminLogin);
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

onAuthStateChanged(auth,(u)=>{
  $("adminLoginBox")?.classList.toggle("hide",!!u);
  $("adminPanel")?.classList.toggle("hide",!u);
  if(u){
    setMsg("");
    load();
  }
});

["orders","bookings","members","coupons","products","consultPrices","settings","visits","adminLogs","banners","benefits"].forEach(c=>{
  try{onSnapshot(collection(db,c),()=>{if(!$("adminPanel")?.classList.contains("hide")) load();});}catch(e){}
});

bind();
