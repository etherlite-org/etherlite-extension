import React, { Component } from 'react'
import PropTypes from 'prop-types'
import contractMap from 'eth-contract-metadata'
import Fuse from 'fuse.js'
import InputAdornment from '@material-ui/core/InputAdornment'
import TextField from '../../../components/ui/text-field'
var tokens = require('./tokens.json')

// const contractList = Object.entries(contractMap)
//   .map(([address, tokenData]) => Object.assign({}, tokenData, { address }))
//   .filter((tokenData) => Boolean(tokenData.erc20))

const contractList = tokens

// change
// const contractList = [
// {
// 	"name": "PoolTogether Dai",
// 	"logo": "pldai.svg",
// 	"erc20": true,
// 	"symbol": "PLDAI",
// 	"decimals": 18,
// 	"address": "0x49d716DFe60b37379010A75329ae09428f17118d"
// }, {
// 	"name": "PoolTogether Sai",
// 	"logo": "plsai.svg",
// 	"erc20": true,
// 	"symbol": "PLSAI",
// 	"decimals": 18,
// 	"address": "0xfE6892654CBB05eB73d28DCc1Ff938f59666Fe9f"
// }, {
// 	"name": "PoolTogether USDC",
// 	"logo": "plusdc.svg",
// 	"erc20": true,
// 	"symbol": "PLUSDC",
// 	"decimals": 6,
// 	"address": "0xBD87447F48ad729C5c4b8bcb503e1395F62e8B98"
// }
// ]



const fuse = new Fuse(contractList, {
  shouldSort: true,
  threshold: 0.45,
  location: 0,
  distance: 100,
  maxPatternLength: 32,
  minMatchCharLength: 1,
  keys: [
    { name: 'name', weight: 0.5 },
    { name: 'symbol', weight: 0.5 },
  ],
})

export default class TokenSearch extends Component {
  static contextTypes = {
    t: PropTypes.func,
    currentCurrencySymbol: PropTypes.string
  }

  static defaultProps = {
    error: null,
  }

  static propTypes = {
    onSearch: PropTypes.func,
    error: PropTypes.string,
  }

  state = {
    searchQuery: '',
  }

  handleSearch (searchQuery) {
    const {currentCurrencySymbol} = this.props
    this.setState({ searchQuery })
    const fuseSearchResult = fuse.search(searchQuery)
    const addressSearchResult = contractList.filter((token) => {
      return token.address.toLowerCase() === searchQuery.toLowerCase()
    })
    let results = [...addressSearchResult, ...fuseSearchResult]
    results = currentCurrencySymbol == 'ETL' ? results : []
    this.props.onSearch({ searchQuery, results })
  }

  renderAdornment () {
    return (
      <InputAdornment
        position="start"
        style={{ marginRight: '12px' }}
      >
        <img src="images/search.svg" />
      </InputAdornment>
    )
  }

  render () {
    const { error } = this.props
    const { searchQuery } = this.state

    return (
      <TextField
        id="search-tokens"
        placeholder={this.context.t('searchTokens')}
        type="text"
        value={searchQuery}
        onChange={(e) => this.handleSearch(e.target.value)}
        error={error}
        fullWidth
        startAdornment={this.renderAdornment()}
      />
    )
  }
}
