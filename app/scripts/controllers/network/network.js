import assert from 'assert'
import EventEmitter from 'events'
import ObservableStore from 'obs-store'
import ComposedStore from 'obs-store/lib/composed'
import EthQuery from 'eth-query'
import JsonRpcEngine from 'json-rpc-engine'
import providerFromEngine from 'eth-json-rpc-middleware/providerFromEngine'
import log from 'loglevel'
import createMetamaskMiddleware from './createMetamaskMiddleware'
import createInfuraClient from './createInfuraClient'
import createJsonRpcClient from './createJsonRpcClient'
import createLocalhostClient from './createLocalhostClient'
import { createSwappableProxy, createEventEmitterProxy } from 'swappable-obj-proxy'

const networks = { networkList: {} }

import {
  RINKEBY,
  MAINNET,
  LOCALHOST,
  INFURA_PROVIDER_TYPES,
  ETHERLITE,
  TESTLITE
} from './enums'

const env = process.env.METAMASK_ENV
const METAMASK_DEBUG = process.env.METAMASK_DEBUG

let defaultProviderConfigType
if (process.env.IN_TEST === 'true') {
  defaultProviderConfigType = LOCALHOST
// } else if (METAMASK_DEBUG || env === 'test') {
//   defaultProviderConfigType = RINKEBY
} else {
  defaultProviderConfigType = ETHERLITE
}

const defaultProviderConfig = {
  type: defaultProviderConfigType,
  etherliteRpcTarget: 'https://rpc.etherlite.org',
  etherliteChainId: 111,
  etherliteNickname:'etherlite',
  testliteRpcTarget: 'https://rpc-testlite.etherlite.org',
  testliteChainId: 142,
  testliteNickname:'testlite',
}

const defaultNetworkConfig = {
  ticker: 'ETL',
}

export default class NetworkController extends EventEmitter {

  constructor (opts = {}) {
    super()

    // parse options
    const providerConfig = opts.provider || defaultProviderConfig
    // create stores
    this.providerStore = new ObservableStore(providerConfig)
    this.networkStore = new ObservableStore('loading')
    this.networkConfig = new ObservableStore(defaultNetworkConfig)
    this.store = new ComposedStore({ provider: this.providerStore, network: this.networkStore, settings: this.networkConfig })
    this.on('networkDidChange', this.lookupNetwork)
    // provider and block tracker
    this._provider = null
    this._blockTracker = null
    // provider and block tracker proxies - because the network changes
    this._providerProxy = null
    this._blockTrackerProxy = null
  }

  initializeProvider (providerParams) {
    this._baseProviderParams = providerParams
    //const { type, rpcTarget, chainId, ticker, nickname } = this.providerStore.getState()
    let { type, rpcTarget, chainId, ticker, nickname } = this.providerStore.getState()
    if(type === ETHERLITE || type === TESTLITE){
       if(type === ETHERLITE) {
        let { etherliteRpcTarget, etherliteChainId, etherliteNickname } = this.providerStore.getState()
        rpcTarget = etherliteRpcTarget
        chainId = etherliteChainId
        nickname = etherliteNickname
       } else if(type === TESTLITE) {
        let { testliteRpcTarget, testliteChainId, testliteNickname } = this.providerStore.getState()
        rpcTarget = testliteRpcTarget
        chainId = testliteChainId
        nickname = testliteNickname
       }
    } else {
      assert(true, `NetworkController - Unknown data"${type} "`)
    }
    this._configureProvider({ type, rpcTarget, chainId, ticker, nickname })
    this.lookupNetwork()
  }

  // return the proxies so the references will always be good
  getProviderAndBlockTracker () {
    const provider = this._providerProxy
    const blockTracker = this._blockTrackerProxy
    return { provider, blockTracker }
  }

  verifyNetwork () {
    // Check network when restoring connectivity:
    if (this.isNetworkLoading()) {
      this.lookupNetwork()
    }
  }

  getNetworkState () {
    return this.networkStore.getState()
  }

  getNetworkConfig () {
    return this.networkConfig.getState()
  }

  setNetworkState (network, type) {
    if (network === 'loading') {
      return this.networkStore.putState(network)
    }

    // type must be defined
    if (!type) {
      return
    }
    network = networks.networkList[type]?.chainId || network
    return this.networkStore.putState(network)
  }

  isNetworkLoading () {
    return this.getNetworkState() === 'loading'
  }

  lookupNetwork () {
    // Prevent firing when provider is not defined.
    if (!this._provider) {
      return log.warn('NetworkController - lookupNetwork aborted due to missing provider')
    }
    const { type } = this.providerStore.getState()
    const ethQuery = new EthQuery(this._provider)
    const initialNetwork = this.getNetworkState()
    ethQuery.sendAsync({ method: 'net_version' }, (err, network) => {
      const currentNetwork = this.getNetworkState()
      if (initialNetwork === currentNetwork) {
        if (err) {
          return this.setNetworkState('loading')
        }
        log.info('web3.getNetwork returned ' + network)
        this.setNetworkState(network, type)
      }
    })
  }

  setRpcTarget (rpcTarget, chainId, ticker = 'ETL', nickname = '', rpcPrefs) {
    const providerConfig = {
      type: 'rpc',
      rpcTarget,
      chainId,
      ticker,
      nickname,
      rpcPrefs,
    }
    this.providerConfig = providerConfig
  }

  async setProviderType (type, rpcTarget = '', ticker = 'ETL', nickname = '') {
    assert.notEqual(type, 'rpc', `NetworkController - cannot call "setProviderType" with type 'rpc'. use "setRpcTarget"`)
    assert(INFURA_PROVIDER_TYPES.includes(type) || type === LOCALHOST || type === ETHERLITE || type === TESTLITE, `NetworkController - Unknown rpc type "${type}"`)
    const providerConfig = { type, rpcTarget, ticker, nickname }
    this.providerConfig = providerConfig
  }

  resetConnection () {
    this.providerConfig = this.getProviderConfig()
  }

  set providerConfig (providerConfig) {
    this.providerStore.updateState(providerConfig)
    this._switchNetwork(providerConfig)
  }

  getProviderConfig () {
    return this.providerStore.getState()
  }

  //
  // Private
  //

  _switchNetwork (opts) {
    this.setNetworkState('loading')
    this._configureProvider(opts)
    this.emit('networkDidChange', opts.type)
  }

  _configureProvider (opts) {
    let { type, rpcTarget, chainId, ticker, nickname } = opts
    // infura type-based endpoints
    const isInfura = INFURA_PROVIDER_TYPES.includes(type)
    if (isInfura) {
      this._configureInfuraProvider(opts)
    // other type-based rpc endpoints
    } else if (type === LOCALHOST) {
      this._configureLocalhostProvider()
    // url-based rpc endpoints
    } else if (type === 'rpc') {
      this._configureStandardProvider({ rpcUrl: rpcTarget, chainId, ticker, nickname })
    } else if (type === ETHERLITE || type === TESTLITE) {
      if(type === ETHERLITE){
        let { etherliteRpcTarget, etherliteChainId, etherliteNickname } = this.providerStore.getState()
          rpcTarget = etherliteRpcTarget
          chainId = etherliteChainId
          nickname = etherliteNickname
      } else if (type === TESTLITE) {
        let { testliteRpcTarget, testliteChainId, testliteNickname } = this.providerStore.getState()
          rpcTarget = testliteRpcTarget
          chainId = testliteChainId
          nickname = testliteNickname
      } else {
      }
      this._configureCeloProvider({type, rpcUrl: rpcTarget, chainId, ticker, nickname })
    } else {
      throw new Error(`NetworkController - _configureProvider - unknown type "${type}"`)
    }
  }

  _configureInfuraProvider ({ type }) {
    log.info('NetworkController - configureInfuraProvider', type)
    const networkClient = createInfuraClient({
      network: type,
    })
    this._setNetworkClient(networkClient)
    // setup networkConfig
    const settings = {
      ticker: 'ETL',
    }
    this.networkConfig.putState(settings)
  }

  _configureLocalhostProvider () {
    log.info('NetworkController - configureLocalhostProvider')
    const networkClient = createLocalhostClient()
    this._setNetworkClient(networkClient)
  }

  _configureStandardProvider ({ rpcUrl, chainId, ticker, nickname }) {
    log.info('NetworkController - configureStandardProvider', rpcUrl)
    const networkClient = createJsonRpcClient({ rpcUrl })
    // hack to add a 'rpc' network with chainId
    networks.networkList['rpc'] = {
      chainId,
      rpcUrl,
      ticker: ticker || 'ETL',
      nickname,
    }
    // setup networkConfig
    let settings = {
      network: chainId,
    }
    settings = Object.assign(settings, networks.networkList['rpc'])
    this.networkConfig.putState(settings)
    this._setNetworkClient(networkClient)
  }

  _configureCeloProvider ({ type, rpcUrl, chainId, ticker, nickname }) {
    log.info('NetworkController - configureStandardProvider', rpcUrl)
    const networkClient = createJsonRpcClient({ rpcUrl })
    networks.networkList[type] = {
      chainId,
      rpcUrl,
      ticker: ticker || 'ETL',
      nickname,
    }
    // setup networkConfig
    let settings = {
      network: chainId,
    }
    settings = Object.assign(settings, networks.networkList[type])
    this.networkConfig.putState(settings)
    this._setNetworkClient(networkClient)
  }


  _setNetworkClient ({ networkMiddleware, blockTracker }) {
    const metamaskMiddleware = createMetamaskMiddleware(this._baseProviderParams)
    const engine = new JsonRpcEngine()
    engine.push(metamaskMiddleware)
    engine.push(networkMiddleware)
    const provider = providerFromEngine(engine)
    this._setProviderAndBlockTracker({ provider, blockTracker })
  }

  _setProviderAndBlockTracker ({ provider, blockTracker }) {
    // update or intialize proxies
    if (this._providerProxy) {
      this._providerProxy.setTarget(provider)
    } else {
      this._providerProxy = createSwappableProxy(provider)
    }
    if (this._blockTrackerProxy) {
      this._blockTrackerProxy.setTarget(blockTracker)
    } else {
      this._blockTrackerProxy = createEventEmitterProxy(blockTracker, { eventFilter: 'skipInternal' })
    }
    // set new provider and blockTracker
    this._provider = provider
    this._blockTracker = blockTracker
  }
}
