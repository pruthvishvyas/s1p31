import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="card state-box" role="alert">
          <p>{'Something went wrong while showing ' + (this.props.label || 'this section') + '. The rest of the page still works.'}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
