import { connect } from 'react-redux'
import CurrencyInput from './currency-input.component'
import { ETH } from '../../../helpers/constants/common'
import {
  getSendMaxModeState,
  getIsMainnet,
  getPreferences,
  getCurrentCurrencySym
} from '../../../selectors'

const mapStateToProps = (state) => {
  const { metamask: { nativeCurrency, currentCurrency, conversionRate } } = state
  const { showFiatInTestnets } = getPreferences(state)
  const isMainnet = getIsMainnet(state)
  const maxModeOn = getSendMaxModeState(state)
  const currentCurrencySymbol = getCurrentCurrencySym(state) //XXX

  return {
    nativeCurrency,
    currentCurrency,
    conversionRate,
    hideFiat: (!isMainnet && !showFiatInTestnets),
    maxModeOn,
    currentCurrencySymbol
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const { nativeCurrency, currentCurrency } = stateProps

  return {
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
    nativeSuffix: nativeCurrency || ETH,
    fiatSuffix: currentCurrency.toUpperCase(),
  }
}

export default connect(mapStateToProps, null, mergeProps)(CurrencyInput)
