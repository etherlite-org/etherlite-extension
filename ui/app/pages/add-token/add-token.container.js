import { connect } from 'react-redux'
import AddToken from './add-token.component'

import { setPendingTokens, clearPendingTokens } from '../../store/actions'
import { getMostRecentOverviewPage } from '../../ducks/history/history'
import { getCurrentCurrencySymbol } from '../../selectors/selectors'

const mapStateToProps = (state) => {
  const { metamask: { identities, tokens, pendingTokens } } = state
  const currentCurrencySymbol = getCurrentCurrencySymbol(state)


  return {
    identities,
    mostRecentOverviewPage: getMostRecentOverviewPage(state),
    tokens,
    pendingTokens,
    currentCurrencySymbol
  }
}

const mapDispatchToProps = (dispatch) => {
  return {
    setPendingTokens: (tokens) => dispatch(setPendingTokens(tokens)),
    clearPendingTokens: () => dispatch(clearPendingTokens()),
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(AddToken)
