import Snabbdom from 'snabbdom-pragma'
import { formatSat, formatNumber } from './util'
import * as d3 from 'd3/dist/d3.min.js'
import layout from './layout'

let simulation_log = null
let svg = null

let selectedNode = null
let selectedWallet = null

let address_wallet_map = {}

let nodes = []
let links = []
let wallet_info = {}
let blocks = {}
let nodesMap = new Map()

let rerender_logntwork = false
export const rerender_logntwork_opt = (stat) => {
  rerender_logntwork = stat
}
let simulation_log_paused = false
export const regtestnetlog_simulation_opt = (stat) => {  
  simulation_log_paused = stat
  if (simulation_log_paused) {
    simulation_log && simulation_log.stop()
  }
}

const buildNetworkFromData = (data) => {
  wallet_info = data.wallets
  
  blocks = Object.fromEntries(
    data.blocks.map(item => [item.height, item]) // 将每个对象转换为 [key, value] 数组对
  );
  nodes = data.nodes.map(item => {
    let id = ''
    let radius = 50
    if (item.type == 'wallet') {
      id = `wallet_${item.name}`
      radius = 50
    } else if (item.type == 'block') {
      id = `block_${item.height}`
      radius = 60
    } else if (item.type == 'tx') {
      id = `tx_${item.txid}`
      radius = 30
    } else if (item.type == 'mine') {
      id = `mine_${item.txid}`
      radius = 35
    }
    return {
      ...item,
      id: id,
      radius: radius
    }
  })
  links = []
  nodes.forEach(item => {
    if (item.type == 'wallet') {
      nodesMap.set(`wallet_${item.name}`, item)
    } else if (item.type == 'block') {
      if (item.next_hash && blocks[item.next_height]) {
        nodesMap.set(`block_${item.height}`, item)
        links.push({
          source: `block_${item.height}`,
          target: `block_${item.next_height}`,
          type: 'chain'
        }) 
      }
    } else if (item.type == 'tx') {
      nodesMap.set(`tx_${item.txid}`, item)

      links.push({
        source: `wallet_${item.source}`,
        target: `tx_${item.txid}`,
        type: 'wallet-to-tx'
      })
      links.push({
        source: `tx_${item.txid}`,
        target: `wallet_${item.target}`,
        type: 'tx-to-wallet'
      })
      links.push({
        source: `tx_${item.txid}`,
        target: `block_${item.height}`,
        type: 'tx-to-block'
      })
    } else if (item.type == 'mine') {
      nodesMap.set(`mine_${item.txid}`, item)

      links.push({
        source: `block_${item.height}`,
        target: `mine_${item.txid}`,
        type: 'mineblock-to-tx'
      })
      links.push({
        source: `mine_${item.txid}`,
        target: `wallet_${item.target}`,
        type: 'minetx-to-wallet'
      })
    }
  })
}

// 渲染网络图
const renderNetworkLog = (data) => {
  buildNetworkFromData(data)
  const container = document.querySelector('.address-network-chart')
  if (!container) return

  const width = Math.round(window.innerWidth)
  const height = window.innerHeight - 79

  d3.select('.address-network-chart svg').remove()
  svg = d3.select('.address-network-chart').append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('class', 'tx-flow-svg')

  const defs = svg.append('defs')

  // 定义箭头标记
  defs.append('marker')
    .attr('id', 'arrowhead')
    .attr('markerWidth', 10)
    .attr('markerHeight', 10)
    .attr('refX', 9)
    .attr('refY', 3)
    .attr('orient', 'auto')
    .append('polygon')
    .attr('points', '0 0, 10 3, 0 6')
    .attr('fill', '#aaa')

  const g = svg.append('g').attr('class', 'network-graph')

  const zoom = d3.zoom().on('zoom', e => {
    g.attr('transform', e.transform)
  })
  svg.call(zoom)

  if (simulation_log) {
    simulation_log.stop()
    simulation_log = null
  }

  // 创建力导向图
  simulation_log = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links)
      .id(d => typeof d === 'string' ? d : d.id)
      .distance(d => {
        const src = typeof d.source === 'string' ? d.source : d.source.id
        const tgt = typeof d.target === 'string' ? d.target : d.target.id
        const isEdgeNode = (id) => graphNodes.some(n => n.id === id && n.gtype === 'edge')
        
        // 交易到区块的距离更远
        if (d.type === 'tx-to-block' || d.type == 'mineblock-to-tx' || d.type == 'chain') {
          return 600
        }
        // wallet到交易的距离
        if (d.type === 'wallet-to-tx' || d.type === 'tx-to-wallet') {
          return 400
        }
        if (d.type == 'minetx-to-wallet') {
          return 500
        }
        return 300
      })
      .strength(0.5))
    .force('charge', d3.forceManyBody()
      .strength(d => {
        switch (d.type) {
          case 'block': return -900
          case 'wallet': return -500
          case 'tx': return -300
          case 'mine': return -400
          default: return -300
        }
      }))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide()
      .radius(d => d.radius + 5))

  // 绘制连线
  const links_g = g.selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', d => {
        if (d.type === 'tx-to-block') {
          return '#999'
        }
        // if (d.type === 'chain') {
        //   return '#ffff00'
        // }
        // if (d.type === 'mineblock-to-tx') {
        //   return '#ff9800'
        // }
        // if (d.type === 'minetx-to-wallet') {
        //   return '#ff9800'
        // }
        return '#999'
      }).attr('stroke-opacity', d => {
        if (d.type === 'tx-to-block') {
          return 0.3
        }
        if (d.type === 'wallet-to-tx' || d.type === 'tx-to-wallet') {
          return 0.3
        }
        if (d.type === 'mineblock-to-tx' || d.type === 'minetx-to-wallet' || d.type === 'chain') {
          return 0.8
        }
        return 0.4
      }).attr('stroke-width', d => {
        // if (d.type === 'tx-to-block') {
        //   return 2
        // }
        // if (d.type === 'wallet-to-tx' || d.type === 'tx-to-wallet') {
        //   return 2
        // }
        if (d.type === 'mineblock-to-tx' || d.type === 'minetx-to-wallet' || d.type === 'chain') {
          return 2.2
        }
        return 2
      }).attr('marker-end', d => {
        return 'url(#arrowhead)'
      })

  // 绘制节点
  const nodes_g = g.selectAll('g.node')
    .data(nodes)
    .enter()
    .append('g')
    .attr('class', 'node')
    .call(d3.drag()
      .on('start', e => {
        if (!e.active) simulation_log.alphaTarget(0.3).restart()
        e.subject.fx = e.subject.x
        e.subject.fy = e.subject.y
      })
      .on('drag', e => {
        e.subject.fx = e.x
        e.subject.fy = e.y
      })
      .on('end', e => {
        if (!e.active) simulation_log.alphaTarget(0)
        e.subject.fx = null
        e.subject.fy = null
      }))
    .on('click', (e, d) => {
      e.stopPropagation()
      selectedNode = d
     
      // let _wallet_info = wallet_info.filter(wallet_item => wallet_item.walletname === address_wallet_map[d.id])
      // if (_wallet_info.length > 0) {
      //   selectedWallet = _wallet_info[0]
      // }

      // panel_open()
      // updateDetailPanel()
    })

  nodes_g.filter(d => d.type === 'wallet').append('circle')
    .attr('r', d => d.radius)
    .attr('fill', '#2196F3')
    .attr('opacity', 0.6)
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)
    .attr('cursor', 'pointer')

  nodes_g.filter(d => d.type === 'tx').append('circle')
    .attr('r', d => d.radius)
    .attr('fill', '#dd8800')
    .attr('opacity', 0.6)
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)
    .attr('cursor', 'pointer')

  nodes_g.filter(d => d.type === 'mine').append('circle')
    .attr('r', d => d.radius)
    .attr('fill', '#ffff00')
    .attr('opacity', 0.6)
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)
    .attr('cursor', 'pointer')

  // 绘制区块节点 
  const blockNodeGroups = nodes_g.filter(d => d.type === 'block')
  blockNodeGroups.append('rect')
    .attr('x', d => -d.radius)
    .attr('y', d => -d.radius)
    .attr('width', d => d.radius * 2)
    .attr('height', d => d.radius * 2 + 10)
    .attr('fill', '#7c4dff')
    .attr('opacity', 0.6)
    .attr('rx', 4)
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)

  blockNodeGroups.append('text')
    .attr('text-anchor', 'middle')
    .attr('y', - 26 - 13)
    .attr('font-size', '13px')
    .attr('font-weight', 'bold')
    .attr('fill', '#00ffff')
    .text(d => `Block: ${d.height}`)
  // // 区块 index
  // blockNodeGroups.append('text')
  //   .attr('text-anchor', 'middle')
  //   .attr('y', - 26)
  //   .attr('font-size', '12px')
  //   .attr('font-weight', 'bold')
  //   .attr('fill', '#00ffff')
  //   .text(d => `height: ${d.height}`)

  // 区块hash
  blockNodeGroups.append('text')
    .attr('text-anchor', 'middle')
    .attr('y', 13 - 26)
    .attr('font-size', '10px')
    .attr('fill', '#fff')
    .text(d => 'hash: ...' + d.hash.substring(d.hash.length - 5, d.hash.length))
  
  // 区块中的交易数
  blockNodeGroups.append('text')
    .attr('text-anchor', 'middle')
    .attr('y', 26 - 26)
    .attr('font-size', '11px')
    .attr('fill', '#fff')
    .attr('font-weight', 'bold')
    .text(d => `${d.tx_count} txs`)
  
  // 区块奖励
  blockNodeGroups.append('text')
    .attr('text-anchor', 'middle')
    .attr('y', 30 - 26)
    .attr('font-size', '10px')
    .attr('fill', '#fff')
    .attr('font-weight', 'bold')
    .text(d => `award: ${d.bonus} BTC`)

  // // 区块fee
  // blockNodeGroups.append('text')
  //   .attr('text-anchor', 'middle')
  //   .attr('y', 52 - 26)
  //   .attr('font-size', '10px')
  //   .attr('fill', '#fff')
  //   .attr('font-weight', 'bold')
  //   .text(d => `fee: ${d.fee} BTC`)

  blockNodeGroups.append('text')
    .attr('text-anchor', 'middle')
    .attr('y', 72 - 26)
    .attr('font-size', '14px')
    .attr('fill', '#fff')
    .attr('font-weight', 'bold')
    .text('miner:')

  // 区块 奖励给 miner
  blockNodeGroups.append('text')
    .attr('text-anchor', 'middle')
    .attr('y', 86 - 26)
    .attr('font-size', '12px')
    .attr('fill', '#fff')
    .attr('font-weight', 'bold')
    .text(d => `${d.miner}`)

  nodes_g.filter(d => d.type === 'wallet')
      .append("text")
      .attr("text-anchor", "middle")
      .attr('y', -10)
      .attr("fill", "#fff")
      .attr("font-size", 12)
      .text(d => d.name);
  nodes_g.filter(d => d.type === 'wallet')
      .append("text")
      .attr("text-anchor", "middle")
      .attr('y', 3)
      .attr("fill", "#fff")
      .attr("font-size", 12)
      .text(d => wallet_info[d.name].balance);
  nodes_g.filter(d => d.type === 'wallet')
      .append("text")
      .attr("text-anchor", "middle")
      .attr('y', 16)
      .attr("fill", "#fff")
      .attr("font-size", 12)
      .text('BTC');

  // 
  nodes_g.filter(d => d.type === 'tx')
      .append("text")
      .attr("text-anchor", "middle")
      .attr('y', -5)
      .attr("fill", "#fff")
      .attr("font-size", 10)
      .text(d => `${d.amount}`);
  nodes_g.filter(d => d.type === 'tx')
      .append("text")
      .attr("text-anchor", "middle")
      .attr('y', 8)
      .attr("fill", "#fff")
      .attr("font-size", 10)
      .text('BTC');

  nodes_g.filter(d => d.type === 'mine')
      .append("text")
      .attr("text-anchor", "middle")
      .attr('y', -10)
      .attr("fill", "#fff")
      .attr("font-size", 10)
      .text('mine');

  nodes_g.filter(d => d.type === 'mine')
      .append("text")
      .attr("text-anchor", "middle")
      .attr('y', 3)
      .attr("fill", "#fff")
      .attr("font-size", 10)
      .text(d => `${d.amount}`);
  nodes_g.filter(d => d.type === 'mine')
      .append("text")
      .attr("text-anchor", "middle")
      .attr('y', 16)
      .attr("fill", "#fff")
      .attr("font-size", 10)
      .text('BTC');

  // 更新位置
  simulation_log.on('tick', () => {
    links_g
      .attr('x1', d => {
        const source = typeof d.source === 'string' 
          ? nodes.find(n => n.id === d.source) 
          : d.source
        return source.x
      })
      .attr('y1', d => {
        const source = typeof d.source === 'string' 
          ? nodes.find(n => n.id === d.source) 
          : d.source
        return source.y
      })
      .attr('x2', d => {
        const target = typeof d.target === 'string' 
          ? nodes.find(n => n.id === d.target) 
          : d.target
        return target.x
      })
      .attr('y2', d => {
        const target = typeof d.target === 'string' 
          ? nodes.find(n => n.id === d.target) 
          : d.target
        return target.y
      })

    nodes_g.attr('transform', d => `translate(${d.x},${d.y})`)
  })

  svg.on('click', () => clearSelection())
}

// 更新详情面板
const updateDetailPanel = () => {
  const panel = document.querySelector('.address-network-detail')
  if (!panel) return

  if (!isPanelOpen) {
    panel.innerHTML = ''
    return  
  }
  
    panel.innerHTML = wallet_info.map(wallet_item => `
      <div class="detail-card">
        <h3>💰 钱包(${wallet_item.walletname})</h3>
        <div class="detail-item">
          <span class="label">可用余额: </span>
          <span class="value">${wallet_item.balance} BTC</span>
        </div>
        <div class="detail-item">
          <span class="label">未确认余额: </span>
          <span class="value">${wallet_item.unconfirmed_balance} BTC</span>
        </div>
        <div class="detail-item">
          <span class="label">未成熟余额(打包区块所得): </span>
          <span class="value">${wallet_item.immature_balance} BTC</span>
        </div>
        <h3></h3>
      </div>
    `).join('')
    panel.innerHTML = `
      ${panel.innerHTML}
      <p className="empty-state">点击图中的节点查看详情</p>
    `

  if (!selectedNode) {
    return
  }

  if (selectedNode.type === 'address') {
    panel.innerHTML = `
      <div class="detail-card">
        <h3>📍 地址详情</h3>
        <div class="detail-item">
          <span class="label">地址</span>
          <span class="value">${selectedNode.id}</span>
        </div>
        <div class="detail-item">
          <span class="label">余额</span>
          <span class="value">${formatSat(selectedNode.balance * 100000000)}</span>
        </div>
        <div class="detail-item">
          <span class="label">交易数</span>
          <span class="value">${selectedNode.txCount}</span>
        </div>
        <a href="address/${selectedNode.id}" class="btn-view">查看地址详情 →</a>
        <br/><br/>
        <div class="detail-card">
          <h3>💰 钱包(${selectedWallet.walletname})</h3>
          <div class="detail-item">
            <span class="label">可用余额: </span>
            <span class="value">${selectedWallet.balance} BTC</span>
          </div>
          <div class="detail-item">
            <span class="label">未确认余额: </span>
            <span class="value">${selectedWallet.unconfirmed_balance} BTC</span>
          </div>
          <div class="detail-item">
            <span class="label">未成熟余额(打包区块所得): </span>
            <span class="value">${selectedWallet.immature_balance} BTC</span>
          </div>
        </div>
        <br/>
        <button className="btn btn-primary" onclick="testSend('${address_wallet_map[selectedNode.id]}')">发起一笔交易(金额随机)</button>
        <br/><br/>
        <button className="btn btn-primary" onclick="testMine('${address_wallet_map[selectedNode.id]}')">打包一个区块(也称挖矿)</button>
      </div>
    `
  } else if (selectedNode.type === 'edge') {
    const txList = selectedNode.transactions.map(tx => `
      <div class="tx-item" onclick="viewTransaction('${tx.id}')">
        <div class="tx-item-id">${tx.id}</div>
        <div class="tx-item-amount">💰 ${formatSat(tx.amount * 100000000)}</div>
        <div class="tx-item-time">${new Date(tx.time * 1000).toLocaleString()}</div>
      </div>
    `).join('')

    panel.innerHTML = `
      <div class="detail-card">
        <h3>💸 转账详情</h3>
        <div class="detail-item">
          <span class="label">转账方向</span>
          <span class="value">${selectedNode.sourceLabel == 'coinbase' ? '挖矿(打包区块)所得' : selectedNode.sourceLabel} → ${selectedNode.targetLabel}</span>
        </div>
        <div class="detail-item">
          <span class="label">交易数</span>
          <span class="value">${selectedNode.txCount}</span>
        </div>
        <div class="detail-item">
          <span class="label">总金额</span>
          <span class="value">${formatSat(selectedNode.totalAmount * 100000000)}</span>
        </div>
        <div class="transactions-section">
          <h4>📑 交易列表</h4>
          <div class="transaction-list">
            ${txList}
          </div>
        </div>
      </div>
    `
  }
}

// 清除选择
const clearSelection = () => {
  selectedNode = null
  selectedWallet = null
  updateDetailPanel()
}

// 重置视图
const resetZoom = () => {
  if (svg) {
    svg.transition()
      .duration(750)
      .call(d3.zoom().transform, d3.zoomIdentity)
  }
}

const isTouch = process.browser && ('ontouchstart' in window)
// 主渲染函数
const homeLayout = (body, { t, activeTab, ...S }) => layout(
 <div>
    { body }
  </div>
, { t, isTouch, activeTab, ...S })


// const trick_wallet = () => {
//   getwalletinfo().then(infoes => {
//     if (wallet_info.length > 0) {
//       let type = 0
//       for (const [index, element] of wallet_info.entries()) {
//         let _walletinfo = infoes.walletinfo
//         if (index == 0) {
//           _walletinfo = infoes.walletinfo
//         } else if (index == 1) {
//           _walletinfo = infoes.walletinfo_cong
//         } else if (index == 2) {
//           _walletinfo = infoes.walletinfo2
//         } else if (index == 3) {
//           _walletinfo = infoes.walletinfo3
//         }
//         if (element.balance != _walletinfo.balance && element.balance < _walletinfo.balance) {
//           type = 2
//           break;
//         }
//         if (element.unconfirmed_balance != _walletinfo.unconfirmed_balance 
//           || element.immature_balance != _walletinfo.immature_balance) {
//           type = 1
//           break;
//         }
//       }
//     }
//     wallet_info = []
//     wallet_info.push(infoes.walletinfo)
//     wallet_info.push(infoes.walletinfo_cong)
//     wallet_info.push(infoes.walletinfo2)
//     wallet_info.push(infoes.walletinfo3)

//     if (selectedWallet) {
//       let _wallet_info = wallet_info.filter(wallet_item => wallet_item.walletname === selectedWallet.walletname)
//       if (_wallet_info.length > 0) {
//         selectedWallet = _wallet_info[0]
//       }
//     }

//     updateDetailPanel()
//   }).catch(error => {
//     console.error("请求失败:", error);
//   });
// }

let isPanelOpen = true;
const panel_open = () => {
  isPanelOpen = true;
  const panel_header = document.querySelector('.panel-header')
  panel_header.innerHTML = '面板-点击折叠';
}

const optPanel = () => {
  isPanelOpen = !isPanelOpen;
  const panel_header = document.querySelector('.panel-header')
  panel_header.innerHTML = isPanelOpen ? '面板-点击折叠' : '面板-点击打开';
  updateDetailPanel();
}

export const regtestNetLog = ({ netlogdata, t, ...S }) => {
  if (simulation_log && simulation_log_paused) {
    rerender_logntwork = false
  }
  if (netlogdata && process.browser) {
    try { console.debug('regtestnet: scheduled client render, hasData=', !!netlogdata) } catch (e) {}
    renderNetworkLog(netlogdata)
    if (!rerender_logntwork) {
      rerender_logntwork = true;
      renderNetworkLog(netlogdata)
    }
  }
  setTimeout(() => {
    rerender_logntwork = false
  }, 360 * 1000)
  return homeLayout(
    <div className="address-network-container" style={{ position: 'relative' }}>
      {/* <div className="panel-header" onclick={optPanel} style={{ boxSizing: 'border-box', position: 'absolute', top: 0, left: '14px', height: '40px', fontSize: '20px', color: '#fff', width: '300px', textAlign: 'center', background: '#00000080' }}>{isPanelOpen ? '面板-点击折叠' : '面板-点击打开'}</div>
      <div className="address-network-detail" style={{ boxSizing: 'border-box', position: 'absolute', top: '48px', left: '14px', height: '580px', maxWidth: '400px', overflowY: 'auto', background: '#00000080' }}>
        <p className="empty-state">{t`点击图中的节点查看详情`}</p>
      </div> */}

      <div className="address-network-content">
          <div className="address-network-chart">
          </div>
      </div>
    </div>
      
  , { ...S, t, activeTab: 'regtestNetLog' })
}

window.clearSelection = clearSelection
window.resetZoom = resetZoom
