import Snabbdom from 'snabbdom-pragma'
import search from './search'
import { rerender_ntwork_opt } from './regtestnet'
function handleLinkClick(e) {
  rerender_ntwork_opt()
  // // 1. 阻止默认跳转行为，为您的函数争取时间
  // e.preventDefault(); 
  
  // // 2. 执行您的函数
  // rerender_ntwork_opt();
  
  // // 3. 手动触发跳转
  // // e.currentTarget 指向 linkElement
  // window.location.href = e.currentTarget.href; 
}

setTimeout(() => {
  const linkElement = document.getElementById('regtest-net-link'); 
  const linkElement2 = document.getElementById('blocks-link'); 
  
  if (linkElement) {
      linkElement.removeEventListener('click', handleLinkClick); 
      linkElement.addEventListener('click', handleLinkClick);
  }
  if (linkElement2) {
      linkElement2.removeEventListener('click', handleLinkClick); 
      linkElement2.addEventListener('click', handleLinkClick);
  }
}, 800);

export default ( t, isTouch, activeTab) => {
  return <div className={"sub-navbar" + (activeTab && activeTab === 'regtestNet' ? 'no-bottom-padding' : '')}>
    <div className="container sub-nav-container">
      <div className="sub-nav font-h5">
        <a href="regtestnet" id="regtest-net-link" class={{ active: activeTab == 'regtestNet' }}>Transactions Net</a>
        <a href="." id="dashboard-link" class={{ active: activeTab == 'dashBoard' }}>Dashboard</a>
        <a href="blocks/recent" id="blocks-link" class={{ active: activeTab == 'recentBlocks' }}>Blocks</a>
        <a href="tx/recent" id="tx-link" class={{ active: activeTab == 'recentTxs' }}>Transactions</a>
        { process.env.IS_ELEMENTS ? <a href="assets" class={{ active: activeTab == 'assets' }}>Assets<sup className="highlight"></sup></a> : "" }
        {/* <a href="/explorer-api" class={{ active: activeTab == 'apiLanding' }}>Explorer API</a> */}
      </div>

      { search({ t, autofocus: !isTouch }) }
    </div>
  </div>
}