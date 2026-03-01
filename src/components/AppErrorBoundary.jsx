import { Component } from 'react';

export default class AppErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(err, info) {
    console.error('AppErrorBoundary', err, info);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div
          style={{
            padding: '40px',
            color: '#b91c1c',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            background: '#fff',
            minHeight: '100vh',
            border: '5px solid #b91c1c',
            boxSizing: 'border-box',
            overflow: 'auto',
          }}
        >
          <strong>Erreur dans l'application:\n\n</strong>
          {this.state.error.message}
          {this.state.error.stack ? '\n\n' + this.state.error.stack : ''}
        </div>
      );
    }
    return this.props.children;
  }
}
