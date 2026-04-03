"use client";
import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Error stack:", error.stack);
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          borderRadius: '8px',
          fontFamily: 'monospace',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <h2 style={{ color: '#991b1b', marginBottom: '20px' }}>Application Error</h2>
          <pre style={{
            background: '#fff7ed',
            padding: '20px',
            borderRadius: '4px',
            overflow: 'auto',
            maxWidth: '800px',
            color: '#7c2d12'
          }}>
            <strong>Error:</strong> {this.state.error && this.state.error.toString()}
            {'\n\n'}
            <strong>Stack:</strong>
            {'\n'}
            {this.state.error && this.state.error.stack}
            {'\n\n'}
            <strong>Component Stack:</strong>
            {'\n'}
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              background: '#1f2937',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
