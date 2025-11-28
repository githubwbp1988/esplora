import Snabbdom from 'snabbdom-pragma'
import { formatSat, formatNumber } from './util'
import loader from '../components/loading'
// Use the prebuilt UMD bundle so Browserify doesn't need to transpile
// ES modules inside node_modules (d3 ships ESM sources in `src/`).
import * as d3 from 'd3/dist/d3.min.js'
import layout from './layout'

let simulation = null
let svg = null
let edgeCollection = []
let graphNodes = []
let graphEdges = []
let selectedNode = null
let selectedWallet = null

let address_wallet_map = {}
let address_wallet_processed = false

let rerender_ntwork = false
export const rerender_ntwork_opt = (stat) => {
  rerender_ntwork = stat
}
let simulation_paused = false
export const regtestnet_simulation_opt = (stat) => {  
  simulation_paused = stat
  if (simulation_paused) {
    simulation && simulation.stop()
  }
}

let pending_address_wallet = []
let pending_address_processing = false

let wallet_info = []
let isTesting = false

const generateMockData = () => {
  const baseTime = Math.floor(Date.now() / 1000);
  const test_data = {
  // const scenarios = {
      // simple: {
      //     addresses: [
      //         { id: 'addr:1', label: '地址 A', balance: 5.0, txCount: 3 },
      //         { id: 'addr:2', label: '地址 B', balance: 3.0, txCount: 4 },
      //         { id: 'addr:3', label: '地址 C', balance: 2.0, txCount: 2 },
      //     ],
      //     edges: [
      //         {
      //             source: 'addr:1',
      //             target: 'addr:2',
      //             transactions: [
      //                 { id: 'tx001', amount: 1.5, time: baseTime - 3600, confirms: 10 },
      //                 { id: 'tx002', amount: 0.8, time: baseTime - 1800, confirms: 5 },
      //             ]
      //         },
      //         {
      //             source: 'addr:2',
      //             target: 'addr:3',
      //             transactions: [
      //                 { id: 'tx003', amount: 1.2, time: baseTime - 900, confirms: 3 },
      //             ]
      //         },
      //         {
      //             source: 'addr:3',
      //             target: 'addr:1',
      //             transactions: [
      //                 { id: 'tx004', amount: 0.5, time: baseTime - 300, confirms: 1 },
      //             ]
      //         },
      //     ]
      // },
      // complex: {
      addresses: [
          { id: 'addr:hub', label: '交易所', balance: 100.0, txCount: 50 },
          { id: 'addr:1', label: '用户 A', balance: 5.0, txCount: 8 },
          { id: 'addr:2', label: '用户 B', balance: 3.0, txCount: 6 },
          { id: 'addr:3', label: '用户 C', balance: 2.0, txCount: 4 },
          { id: 'addr:4', label: '矿池', balance: 10.0, txCount: 20 },
      ],
      edges: [
          {
              source: 'addr:hub',
              target: 'addr:1',
              transactions: [
                  { id: 'tx101', amount: 2.0, time: baseTime - 7200, confirms: 20 },
                  { id: 'tx102', amount: 1.5, time: baseTime - 3600, confirms: 15 },
                  { id: 'tx103', amount: 1.2, time: baseTime - 1800, confirms: 8 },
              ]
          },
          {
              source: 'addr:hub',
              target: 'addr:2',
              transactions: [
                  { id: 'tx104', amount: 1.8, time: baseTime - 5400, confirms: 18 },
              ]
          },
          {
              source: 'addr:1',
              target: 'addr:hub',
              transactions: [
                  { id: 'tx105', amount: 0.5, time: baseTime - 2700, confirms: 12 },
              ]
          },
          {
              source: 'addr:4',
              target: 'addr:hub',
              transactions: [
                  { id: 'tx106', amount: 5.0, time: baseTime - 900, confirms: 2 },
              ]
          },
      ]
      // },
      // tree: {
      //     addresses: [
      //         { id: 'addr:0', label: '源地址', balance: 20.0, txCount: 5 },
      //         { id: 'addr:1', label: '冷钱包', balance: 5.0, txCount: 2 },
      //         { id: 'addr:2', label: '热钱包', balance: 5.0, txCount: 3 },
      //         { id: 'addr:3', label: '托管方', balance: 5.0, txCount: 2 },
      //         { id: 'addr:4', label: '用户 1', balance: 2.0, txCount: 3 },
      //         { id: 'addr:5', label: '用户 2', balance: 3.0, txCount: 2 },
      //     ],
      //     edges: [
      //         {
      //             source: 'addr:0',
      //             target: 'addr:1',
      //             transactions: [
      //                 { id: 'tx201', amount: 5.0, time: baseTime - 10800, confirms: 50 },
      //             ]
      //         },
      //         {
      //             source: 'addr:0',
      //             target: 'addr:2',
      //             transactions: [
      //                 { id: 'tx202', amount: 5.0, time: baseTime - 7200, confirms: 40 },
      //             ]
      //         },
      //         {
      //             source: 'addr:2',
      //             target: 'addr:4',
      //             transactions: [
      //                 { id: 'tx203', amount: 2.0, time: baseTime - 3600, confirms: 25 },
      //             ]
      //         },
      //         {
      //             source: 'addr:2',
      //             target: 'addr:5',
      //             transactions: [
      //                 { id: 'tx204', amount: 1.5, time: baseTime - 1800, confirms: 10 },
      //             ]
      //         },
      //         {
      //             source: 'addr:3',
      //             target: 'addr:1',
      //             transactions: [
      //                 { id: 'tx205', amount: 3.0, time: baseTime - 900, confirms: 5 },
      //             ]
      //         },
      //     ]
      // }
  }
  return test_data;
}

// 生成地址网络数据结构
const buildNetworkFromData = (data) => {
  // test_data
  // data = generateMockData()
  graphNodes = data.addresses.map(addr => ({
    ...addr,
    type: 'address',
    radius: 50
  }))

  edgeCollection = []
  graphEdges = []

  data.edges.forEach((edge, idx) => {
    const edgeId = `edge:${idx}`
    const source = graphNodes.find(n => n.id === edge.source)
    const target = graphNodes.find(n => n.id === edge.target)

    if (source && target) {
      const txCount = edge.transactions.length
      const totalAmount = edge.transactions.reduce((s, t) => s + t.amount, 0)

      edgeCollection.push({
        id: edgeId,
        type: 'edge',
        sourceAddr: edge.source,
        targetAddr: edge.target,
        sourceLabel: source.label,
        targetLabel: target.label,
        transactions: edge.transactions,
        txCount: txCount,
        totalAmount: totalAmount,
        radius: 18
      })

      graphEdges.push({ source: edge.source, target: edgeId })
      graphEdges.push({ source: edgeId, target: edge.target })
    } else if (target) {
      const txCount = edge.transactions.length
      const totalAmount = edge.transactions.reduce((s, t) => s + t.amount, 0)

      edgeCollection.push({
        id: edgeId,
        type: 'edge',
        sourceAddr: edge.source,
        targetAddr: edge.target,
        sourceLabel: edge.source,
        targetLabel: target.label,
        transactions: edge.transactions,
        txCount: txCount,
        totalAmount: totalAmount,
        radius: 18
      })

      graphEdges.push({ source: edgeId, target: edge.target })
    }
  })

  graphNodes.push(...edgeCollection)
  return { nodes: graphNodes, edges: graphEdges }
}

// 渲染网络图
const renderNetwork = (data) => {
  buildNetworkFromData(data)
  const container = document.querySelector('.address-network-chart')
  if (!container) return

  // // If we have graph nodes, remove any loading placeholder inserted by loader()
  // // so the SVG can be rendered in the same container.
  // if (graphNodes && graphNodes.length > 0) {
  //   const loadingEl = container.querySelector('.spinner')
  //   if (loadingEl && loadingEl.remove) loadingEl.remove()
  //   else if (loadingEl && loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl)
  // }

  // const width = container.clientWidth || Math.max(Math.round(window.innerWidth * 0.7), 800)
  const width = Math.round(window.innerWidth)
  // container.clientHeight can be 0 if parent heights aren't set; use a sensible
  // fallback so the SVG doesn't collapse to a very small height.
  // let height = container.clientHeight
  // if (!height || height < 120) {
  //   // Use window height minus 40px (similar to CSS `calc(100vh - 40px)`) as
  //   // the fallback so the chart fills most of the viewport while leaving a
  //   // small gap for nav/header. Ensure a sensible minimum of 240px.
  //   height = Math.max(window.innerHeight - 40, 240)
  // }
  const height = window.innerHeight - 79

  d3.select('.address-network-chart svg').remove()
  svg = d3.select('.address-network-chart').append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('class', 'tx-flow-svg')

  const defs = svg.append('defs')

  // 箭头标记
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

  if (simulation) {
    simulation.stop()
    simulation = null
  }

  // 力导向图
  simulation = d3.forceSimulation(graphNodes)
    .force('link', d3.forceLink(graphEdges)
      .id(d => typeof d === 'string' ? d : d.id)
      .distance(d => {
        const src = typeof d.source === 'string' ? d.source : d.source.id
        const tgt = typeof d.target === 'string' ? d.target : d.target.id
        const isEdgeNode = (id) => graphNodes.some(n => n.id === id && n.type === 'edge')
        
        if (isEdgeNode(src) || isEdgeNode(tgt)) {
          return 80
        }
        return 200
      })
      .strength(0.5))
    .force('charge', d3.forceManyBody()
      .strength(d => d.type === 'edge' ? -50 : -300))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide()
      .radius(d => d.radius + 5))

  // 绘制连线
  const links = g.selectAll('path')
    .data(graphEdges)
    .enter()
    .append('path')
    .attr('class', 'edge-path')
    .attr('stroke', '#999')
    .attr('stroke-opacity', 0.4)
    .attr('fill', 'none')
    .attr('stroke-width', 2)
    .attr('marker-end', 'url(#arrowhead)')

  // 绘制节点
  const nodes = g.selectAll('g.node')
    .data(graphNodes)
    .enter()
    .append('g')
    .attr('class', 'node')
    .call(d3.drag()
      .on('start', e => {
        if (!e.active) simulation.alphaTarget(0.3).restart()
        e.subject.fx = e.subject.x
        e.subject.fy = e.subject.y
      })
      .on('drag', e => {
        e.subject.fx = e.x
        e.subject.fy = e.y
      })
      .on('end', e => {
        if (!e.active) simulation.alphaTarget(0)
        e.subject.fx = null
        e.subject.fy = null
      }))
    .on('click', (e, d) => {
      e.stopPropagation()
      selectedNode = d
     
      let _wallet_info = wallet_info.filter(wallet_item => wallet_item.walletname === address_wallet_map[d.id])
      if (_wallet_info.length > 0) {
        selectedWallet = _wallet_info[0]
      }

      panel_open()
      updateDetailPanel()
    })

  nodes.append('circle')
    .attr('r', d => d.radius)
    .attr('fill', d => d.type === 'address' ? '#2196F3' : (d.txCount > 1 ? '#724e0b' : '#dd8800'))
    .attr('opacity', 0.6)
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)
    .attr('cursor', 'pointer')

  // nodes.filter(d => d.type === 'address')
  //   .append('text')
  //   .attr("text-anchor", "middle")
  //   // .attr("font-family", "sans-serif")
  //   // .attr('dy', '.3em')
  //   .attr('fill', '#fff')
  //   // .attr('font-weight', 'bold')
  //   .attr('pointer-events', 'none')
  //   .attr('font-size', 10)
  //   .text(d => (address_wallet_map[d.id] ? address_wallet_map[d.id] + ': ' : '') + d.label.substring(d.label.length - 5, d.label.length))

  nodes.filter(d => d.type === 'address' && !address_wallet_map[d.id])
    .append('text')
    .attr("text-anchor", "middle")
    .attr('fill', '#fff')
    .attr('pointer-events', 'none')
    .attr('font-size', 10)
    .text(d => '...' + d.label.substring(d.label.length - 5, d.label.length))

  nodes.filter(d => d.type === 'address' && address_wallet_map[d.id])
    .append('g')
    .each(function(d) {
      const g = d3.select(this)
      const addr1 = address_wallet_map[d.id] + ': '
      const addr2 = '...' + d.label.substring(d.label.length - 5, d.label.length)

      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', -5)
        .attr('font-size', '12px')
        .attr('fill', '#fff')
        .attr('font-weight', 'bold')
        .text(addr1)

      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', 12)
        .attr('font-size', '12px')
        .attr('fill', '#fff')
        .attr('font-weight', 'bold')
        .text(addr2)
    })

  // nodes.filter(d => d.type === 'address')
  //     .append("text")
  //     .attr("text-anchor", "middle")
  //     .attr("dominant-baseline", "central") // 垂直居中
  //     .attr("fill", "#fff")
  //     .attr("font-size", 10)
  //     .text(d => address_wallet_map[d.id]);

  // 小圆节点上的数字，可以单独处理，因为它不环绕
  nodes.filter(d => d.type !== 'address')
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central") // 垂直居中
      .attr("fill", "#fff")
      .attr("font-size", 10)
      .text(d => d.txCount + '笔');

  simulation.on('tick', () => {
    links.attr('d', d => {
      const dx = d.target.x - d.source.x
      const dy = d.target.y - d.source.y
      const dr = Math.sqrt(dx * dx + dy * dy) * 1.5
      return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`
    })

    nodes.attr('transform', d => `translate(${d.x},${d.y})`)
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

// // 暂停/继续模拟
// const togglePause = () => {
//   if (simulation) {
//     simulation_paused = !simulation_paused
//     simulation_paused ? simulation.stop() : simulation.restart()
//   }
// }

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

async function limitConcurrency(dataArr, taskFactory, limit) {
  const results = [];
  const runningTasks = new Set(); // 存储正在运行的 Promise

  for (const item of dataArr) {
    // 1. 创建任务 Promise
    const taskPromise = taskFactory(item)
      .then(result => {
        // 任务成功完成后，将它从正在运行的集合中移除
        runningTasks.delete(taskPromise);
        return result; // 返回结果
      })
      .catch(error => {
        // 任务失败完成后，同样将它从正在运行的集合中移除
        runningTasks.delete(taskPromise);
        // 可以选择是否抛出错误，这里我们捕获并记录，然后返回一个标记，让后续的 Promise.all 知道这个任务完成了
        console.error("请求失败:", item, error);
        pending_address_wallet.push(item);
        return { error: true, item };
      });

    // 2. 将新任务加入正在运行的集合
    runningTasks.add(taskPromise);

    // 3. 将任务的结果收集起来 (注意: 这里收集的是任务本身的 Promise，它会在任务执行完成后resolve)
    results.push(taskPromise);

    // 4. 检查是否达到了并发限制
    if (runningTasks.size >= limit) {
      // 等待最快完成的 Promise 
      // 这里的 Promise.race 会返回一个新 Promise，它在 runningTasks 中最快的 Promise 状态改变时，也随之改变
      await Promise.race(runningTasks);
      // 一旦有一个任务完成，上面的 await 就会解除阻塞，循环可以继续，从而维持并发限制。
    }
  }

  // 5. 等待所有剩余的 Promise 完成 (包括那些在循环内尚未完成的任务)
  return Promise.all(results);
}

async function limitConcurrency1(dataArr, taskFactory, limit) {
  const results = [];
  const runningTasks = new Set(); // 存储正在运行的 Promise

  for (const item of dataArr) {
    // 1. 创建任务 Promise
    const taskPromise = taskFactory(item)
      .then(result => {
        // 任务成功完成后，将它从正在运行的集合中移除
        runningTasks.delete(taskPromise);
        return result; // 返回结果
      })
      .catch(error => {
        // 任务失败完成后，同样将它从正在运行的集合中移除
        runningTasks.delete(taskPromise);
        return { error: true, item };
      });

    // 2. 将新任务加入正在运行的集合
    runningTasks.add(taskPromise);

    // 3. 将任务的结果收集起来 (注意: 这里收集的是任务本身的 Promise，它会在任务执行完成后resolve)
    results.push(taskPromise);

    // 4. 检查是否达到了并发限制
    if (runningTasks.size >= limit) {
      await Promise.race(runningTasks);
    }
  }

  // 5. 等待所有剩余的 Promise 完成 (包括那些在循环内尚未完成的任务)
  return Promise.all(results);
}

const wallet_url = process.env.API_URL1.replace(/\/+$/, '')

let last_req_wallet_info_ts = 0
function getwalletinfo() {
  const _url = `${wallet_url}/api/wallet/infoes`;
  // let curr_req_wallet_info_ts = Math.floor(Date.now() / 1000)
  let curr_req_wallet_info_ts = Date.now()
  if (curr_req_wallet_info_ts - last_req_wallet_info_ts < 500) {
    return Promise.resolve();
  }
  last_req_wallet_info_ts = curr_req_wallet_info_ts;
  return fetch(_url)
    .then(response => {
      // 1. 检查响应状态码
      if (!response.ok) {
        // 如果状态码不是 200-299，抛出错误，会被 catch 捕获
        throw new Error(`HTTP 错误! 状态码: ${response.status} for getwalletinfo`);
      }
      
      // 2. 解析 JSON 响应体
      return response.json();
    })
    .then(data => {
      // 3. 成功获取并解析数据
      // console.log(`[DONE]  请求 ID: ${addrId} 成功`);
      // 返回你需要的数据结构
      return data; // 假设 API 返回的数据结构就是你需要的
    })
    .catch(error => {
      // 4. 捕获网络错误、解析错误或 HTTP 错误
      // 将错误重新抛出，以便上层的 Promise.all 或并发控制逻辑能够处理它
      return Promise.reject(new Error(`getwalletinfo 请求失败: ${error.message}`));
    });
}

window.testSend = (wallet_name) => {
  if (isTesting) {
    return;
  }
  isTesting = true;
  const _url = `${wallet_url}/api/wallet/testsend/` + wallet_name;

  return fetch(_url)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP 错误! 状态码: ${response.status} for testsend`);
      }
      isTesting = false;
      return response.json();
    }).then(data => {
      // console.log(' ******** testsend data => ', data)
      trick_wallet();
      setTimeout(() => {
        trick_wallet();
      }, 3000)
      return data;
    }).catch(error => {
      isTesting = false;
      return Promise.reject(new Error(`testSend 请求失败: ${error.message}`));
    });
}
window.testMine = (wallet_name) =>  {
  if (isTesting) {
    return;
  }
  isTesting = true;
  const _url = `${wallet_url}/api/wallet/testmine/` + wallet_name;

  return fetch(_url)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP 错误! 状态码: ${response.status} for testMine`);
      }
      isTesting = false;
      return response.json();
    }).then(data => {
      // console.log(' ******** testmine data => ', data)
      trick_wallet();
      setTimeout(() => {
        trick_wallet();
      }, 3000)
      return data;
    }).catch(error => {
      isTesting = false;
      return Promise.reject(new Error(`testMine 请求失败: ${error.message}`));
    });
}

function checkAddress(addrId) {
  // // 模拟异步 GET 请求
  // return new Promise(resolve => {
  //   const delay = 500 + Math.random() * 1500; // 模拟请求延迟 0.5s 到 2s
    
  //   // 模拟 10% 的请求失败
  //   if (Math.random() < 0.1) {
  //      setTimeout(() => resolve(Promise.reject(new Error(`请求失败: ${addrId}`))), delay);
  //      return;
  //   }
    
  //   // 打印当前正在处理哪个 ID
  //   console.log(`[START] 请求 ID: ${addrId}`);
    
  //   setTimeout(() => {
  //     console.log(`[DONE]  请求 ID: ${addrId}`);
  //     resolve({ id: addrId, status: 'Success', detail: `Details for ${addrId}` });
  //   }, delay);
  // });

  const _url = `${wallet_url}/api/address/check/` + addrId;

  return fetch(_url)
    .then(response => {
      // 1. 检查响应状态码
      if (!response.ok) {
        // 如果状态码不是 200-299，抛出错误，会被 catch 捕获
        throw new Error(`HTTP 错误! 状态码: ${response.status} for ID: ${addrId}`);
      }
      
      // 2. 解析 JSON 响应体
      return response.json();
    })
    .then(data => {
      // 3. 成功获取并解析数据
      // console.log(`[DONE]  请求 ID: ${addrId} 成功`);
      // 返回你需要的数据结构
      return data; // 假设 API 返回的数据结构就是你需要的
      
      // 如果需要格式化，可以这样写：
      // return { id: addrId, status: 'Success', detail: data.details };
    })
    .catch(error => {
      // 4. 捕获网络错误、解析错误或 HTTP 错误
      console.error(`[FAIL]  请求 ID: ${addrId} 失败:`, error.message);
      // 将错误重新抛出，以便上层的 Promise.all 或并发控制逻辑能够处理它
      return Promise.reject(new Error(`请求失败: ${addrId} - ${error.message}`));
    });

  // return new Promise((resolve, reject) => {
  //   const xhr = new XMLHttpRequest();
  //   xhr.open('GET', _url);
  //   xhr.responseType = 'json'; // 告诉浏览器自动解析JSON

  //   xhr.onload = function() {
  //     // 检查 HTTP 状态码
  //     if (xhr.status >= 200 && xhr.status < 300) {
  //       console.log(`[DONE] 请求 ID: ${addrId} 成功`);
  //       resolve(xhr.response);
  //     } else {
  //       // HTTP 错误 (4xx, 5xx)
  //       console.error(`[FAIL] 请求 ID: ${addrId} 失败: HTTP 错误!`);
  //       reject(new Error(`HTTP 错误! 状态码: ${xhr.status} for ID: ${addrId}`));
  //     }
  //   };

  //   xhr.onerror = function() {
  //     // 网络错误
  //     console.error(`[FAIL] 请求 ID: ${addrId} 失败: 网络错误`);
  //     reject(new Error(`网络请求失败: ${addrId}`));
  //   };

  //   xhr.send();
  // });
}

function get_addresses() {
  const _url = `${wallet_url}/api/wallet/addresses`;

  return fetch(_url)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP 错误! 状态码: ${response.status} for /api/wallet/addresses`);
      }
      return response.json();
    })
    .then(data => {
      return data; 
    })
    .catch(error => {
      console.error(`[FAIL]  请求 /api/wallet/addresses 失败:`, error.message);
      return Promise.reject(new Error(`请求失败: /api/wallet/addresses - ${error.message}`));
    });
}

const CONCURRENCY_LIMIT = 40; // 最大并发请求数

function isEmptyUsingForIn(obj) {
  for (const key in obj) {
    // 只要循环运行了一次，就说明对象不为空
    return false;
  }
  return true;
}
const playSoundEffect = (type) => {
    const soundPath1 = '/sounds/coins_received_1.mp3';
    const soundPath2 = '/sounds/coins_received_2.mp3'; 
    let soundPath = '';
    if (type == 1) {
      soundPath = soundPath1
    } else if (type == 2) {
      soundPath = soundPath2
    } else {
      soundPath = soundPath1
    }
    const audio = new Audio(soundPath);
    
    // 尝试播放音效。
    // 注意：浏览器通常要求用户在页面上进行过一次交互（如点击）后才能播放音频。
    // 如果播放失败（例如用户未交互），它会捕获错误但不会中断其他逻辑。
    audio.play().catch(error => {
        console.warn('无法播放音效，可能需要用户先进行页面交互。', error);
    });
}

const trick_wallet = () => {
  getwalletinfo().then(infoes => {
    if (!infoes) {
      return
    }
    if (wallet_info.length > 0) {
      let type = 0
      for (const [index, element] of wallet_info.entries()) {
        let _walletinfo = infoes.walletinfo
        if (index == 0) {
          _walletinfo = infoes.walletinfo
        } else if (index == 1) {
          _walletinfo = infoes.walletinfo_cong
        } else if (index == 2) {
          _walletinfo = infoes.walletinfo2
        } else if (index == 3) {
          _walletinfo = infoes.walletinfo3
        }
        if (element.balance != _walletinfo.balance && element.balance < _walletinfo.balance) {
          type = 2
          break;
        }
        if (element.unconfirmed_balance != _walletinfo.unconfirmed_balance 
          || element.immature_balance != _walletinfo.immature_balance) {
          type = 1
          break;
        }
      }
      if (type > 0) {
        playSoundEffect(type)
      }
    }
    wallet_info = []
    wallet_info.push(infoes.walletinfo)
    wallet_info.push(infoes.walletinfo_cong)
    wallet_info.push(infoes.walletinfo2)
    wallet_info.push(infoes.walletinfo3)

    if (selectedWallet) {
      let _wallet_info = wallet_info.filter(wallet_item => wallet_item.walletname === selectedWallet.walletname)
      if (_wallet_info.length > 0) {
        selectedWallet = _wallet_info[0]
      }
    }

    updateDetailPanel()
  }).catch(error => {
    console.error("请求失败:", error);
  });
}

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

let last_regtest_ts = 0
export const regtestNet = ({ netdata, t, ...S }) => {
  if (simulation && simulation_paused) {
    rerender_ntwork = false
  }
  trick_wallet();
  // Ensure client-side render runs even when Snabbdom's oncreate doesn't fire
  // let curr_regtest_ts = Math.floor(Date.now() / 1000)
  let curr_regtest_ts = Date.now()
  let flag = false
  if (!rerender_ntwork && netdata && curr_regtest_ts - last_regtest_ts > 500) {
    last_regtest_ts = curr_regtest_ts
    flag = true
  } 
  if (flag && netdata && process.browser) {
    setTimeout(() => {
      try { console.debug('regtestnet: scheduled client render, hasData=', !!netdata) } catch (e) {}
      if (!isEmptyUsingForIn(address_wallet_map)) {
        if (!rerender_ntwork) {
          rerender_ntwork = true;
          renderNetwork(netdata)
        }
      }

      if (!address_wallet_processed && isEmptyUsingForIn(address_wallet_map)) {
        address_wallet_processed = true
        // limitConcurrency(
        //   netdata['addresses'], 
        //   (addr) => checkAddress(addr.id), // 任务工厂：传入地址对象，返回请求 Promise
        //   CONCURRENCY_LIMIT
        // )
        // .then(allResults => {
        //   // console.log("\n✅ 所有请求（包括成功和失败的）已完成。");
        //   // // allResults 包含了所有请求的结果，你可以检查哪些成功哪些失败
        //   // console.log("所有结果:", allResults);
        //   allResults.forEach(_item => {
        //     address_wallet_map[_item.address] = _item.walletname
        //   })
        //   renderNetwork(netdata)
        // })
        // .catch(finalError => {
        //   // 如果你在 limitConcurrency 内部选择不捕获错误，而是在 taskFactory 中抛出错误，
        //   // 那么 Promise.all 会立即拒绝，并在这里捕获
        //   console.error("❌ 任务执行过程中发生未捕获的严重错误:", finalError);
        // });
        get_addresses().then(results => {
          results.forEach(_item => {
            address_wallet_map[_item.address] = _item.name
          })
          renderNetwork(netdata)
        })
      } else {
        netdata['addresses'].forEach(addr => {
          if (!address_wallet_map[addr.id]) {
            pending_address_wallet.push(addr)
          }
        })

        if (!pending_address_processing && pending_address_wallet.length > 0) {
          pending_address_processing = true;
          limitConcurrency1(
            pending_address_wallet, 
            (addr) => checkAddress(addr.id), 
            CONCURRENCY_LIMIT
          )
          .then(allResults => {
            allResults.forEach(_item => {
              address_wallet_map[_item.address] = _item.walletname
            })
            renderNetwork(netdata)
            pending_address_processing = false
            pending_address_wallet = []
          })
          .catch(finalError => {
            // 如果你在 limitConcurrency 内部选择不捕获错误，而是在 taskFactory 中抛出错误，
            // 那么 Promise.all 会立即拒绝，并在这里捕获
            console.error("❌ 任务执行过程中发生未捕获的严重错误:", finalError);
            pending_address_processing = false
          });
        }
      }

    }, 100)

    setTimeout(() => {
      rerender_ntwork = false
    }, 360 * 1000)
  }
  return homeLayout(
    // <div className="address-network-container" style={{ display: 'flex', flexDirection: 'row', gap: '1px', alignItems: 'stretch' }}>
    <div className="address-network-container" style={{ position: 'relative' }}>
      {/* Header controls (commented out)
      <div className="address-network-header">
        <h2>{t`Transaction Network Analysis`}</h2>
        <div className="network-controls">
          <button className="btn btn-primary" onclick={() => renderNetwork()}>
            {t`Generate Network`}
          </button>
          <button className="btn btn-secondary" onclick={resetZoom}>
            🔄 {t`Reset View`}
          </button>
          <button className="btn btn-secondary" onclick={togglePause}>
            ⏸ {t`Pause`}
          </button>
        </div>
      </div>
      */}
      <div className="panel-header" onclick={optPanel} style={{ boxSizing: 'border-box', position: 'absolute', top: 0, left: '14px', height: '40px', fontSize: '20px', color: '#fff', width: '300px', textAlign: 'center', background: '#00000080' }}>{isPanelOpen ? '面板-点击折叠' : '面板-点击打开'}</div>
      <div className="address-network-detail" style={{ boxSizing: 'border-box', position: 'absolute', top: '48px', left: '14px', height: '580px', maxWidth: '400px', overflowY: 'auto', background: '#00000080' }}>
        {/* {wallet_info.map(wallet_item => { return (
          <div class="detail-card">
            <h3>💰 钱包(`${wallet_item.walletname}`)</h3>
            <div class="detail-item">
              <span class="label">可用余额: </span>
              <span class="value">{wallet_item.balance} BTC</span>
            </div>
            <div class="detail-item">
              <span class="label">未确认余额: </span>
              <span class="value">{wallet_item.unconfirmed_balance} BTC</span>
            </div>
            <div class="detail-item">
              <span class="label">未成熟余额(打包区块所得): </span>
              <span class="value">{wallet_item.immature_balance} BTC</span>
            </div>
            <h3></h3>
          </div>
        )})} */}
        {/* <p className="empty-state">{t`Click nodes to view details`}</p> */}
        <p className="empty-state">{t`点击图中的节点查看详情`}</p>
      </div>

      <div className="address-network-content">
          <div className="address-network-chart">
            {/* {graphNodes.length == 0 ? loader() : null} */}
          </div>
      </div>

      {/* <div className="address-network-legend">
        <div className="legend-item">
          <div className="legend-color address"></div>
          <span>{t`Address Node`}</span>
        </div>
        <div className="legend-item">
          <div className="legend-color edge"></div>
          <span>{t`Transaction Set`}</span>
        </div>
      </div> */}
    </div>
      
  , { ...S, t, activeTab: 'regtestNet' })
}


// // 导出全局函数供 HTML 调用
// window.viewTransaction = (txid) => {
//   window.location.href = `/tx/${txid}`
// }
window.clearSelection = clearSelection
// window.togglePause = togglePause
window.resetZoom = resetZoom
