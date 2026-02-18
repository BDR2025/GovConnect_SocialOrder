/*
  core/router.js
  - Small hash-router for the GovConnect shell + embedded apps.
  - Keeps app.js lean: app.js only declares the routes and mounts views.
*/

export function createHashRouter({ permissions, canAccess, routes = {}, afterRender }){
  function setActiveNav(route){
    // Topnav
    document.querySelectorAll(".topnav__item").forEach(a=>{
      a.classList.toggle("is-active", a.getAttribute("data-route") === route);
    });

    // Sidebar Sub-Items (Social Order)
    document.querySelectorAll(".sidebar__subItem").forEach(a=>{
      a.classList.toggle("is-active", a.getAttribute("data-route") === route);
    });
  }

  function routeFromHash(){
    const h = (location.hash || "#/app/start").replace(/^#/, "");
    if(!h.startsWith("/")) return "/app/start";
    return h;
  }

  function navTo(route){
    const target = route || "/app/start";
    if(!canAccess(target)){
      const caps = permissions();
      if(caps.canDashboard) return (location.hash = "#/app/dashboard");
      if(caps.canBatch) return (location.hash = "#/app/batch");
      if(caps.canApprovals) return (location.hash = "#/app/approvals");
      return (location.hash = "#/app/start");
    }
    location.hash = "#" + target;
  }

  function normalize(route){
    const base = String(route || "").split("?")[0];
    if(base === "/app" || base === "/app/") return "/app/start";
    return base || "/app/start";
  }

  function render(){
    const raw = routeFromHash();
    const route = normalize(raw);

    if(!canAccess(route)){
      navTo("/app/start");
      return;
    }

    // shell vs. app context
    document.body.classList.toggle("is-in-app", route.startsWith("/app"));

    setActiveNav(route);

    const handler = routes[route] || null;
    if(!handler){
      navTo("/app/start");
      return;
    }

    handler();

    if(typeof afterRender === "function"){
      afterRender(route);
    }
  }

  return { routeFromHash, navTo, render, setActiveNav };
}
