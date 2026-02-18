/* social_order_v0.17.9 · core/modal (ESM)
   Modal-State und einfache Open/Close-API. Kein Domänenwissen.
*/

export function createModal(els){
  let modalContext = null;

  function setModalContext(ctx){
    modalContext = ctx || null;
    const printable = !!(modalContext && modalContext.type === "order");
    if(els.modal) els.modal.classList.toggle("is-printable", printable);
    if(els.modalPrint){
      els.modalPrint.style.display = printable ? "" : "none";
    }
  }

  function getModalContext(){
    return modalContext;
  }

  function openModal(html, opts){
    const o = opts || {};
    const title = o.title || "Details";
    if(els.modalTitle) els.modalTitle.textContent = title;

    if(els.modalBody) els.modalBody.innerHTML = html;
    setModalContext(o.context || null);

    if(els.modal){
      els.modal.classList.add("is-open");
      els.modal.setAttribute("aria-hidden","false");
    }
  }

  function clearPrintRoot(){
    if(!els.printRoot) return;
    els.printRoot.innerHTML = "";
    els.printRoot.setAttribute("aria-hidden","true");
  }

  function closeModal(){
    if(els.modal){
      els.modal.classList.remove("is-open");
      els.modal.setAttribute("aria-hidden","true");
    }
    if(els.modalBody) els.modalBody.innerHTML = "";
    setModalContext(null);
    clearPrintRoot();
  }

  return { openModal, closeModal, setModalContext, getModalContext, clearPrintRoot };
}
