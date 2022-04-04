import { connect } from 'react-redux'
import Identicon from './identicon.component'
import {getCurrentNetworkId} from '../../../selectors/selectors'

const mapStateToProps = (state) => {
  const { metamask: { useBlockie } } = state
  const currentNetworkId = getCurrentNetworkId(state)
  return {
    useBlockie,
    currentNetworkId
  }
}

export default connect(mapStateToProps)(Identicon)
