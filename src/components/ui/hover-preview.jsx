/**
 * HoverPreview Component
 * Displays a markdown preview of conversation content on hover
 */

import React, { useState, useRef, useEffect, cloneElement, isValidElement } from 'react';
import * as Popover from '@radix-ui/react-popover';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import 'highlight.js/styles/github.css';

// Inject animations
if (typeof document !== 'undefined' && !document.getElementById('hover-preview-animations')) {
  const style = document.createElement('style');
  style.id = 'hover-preview-animations';
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translate(-50%, -48%);
      }
      to {
        opacity: 1;
        transform: translate(-50%, -50%);
      }
    }
  `;
  document.head.appendChild(style);
}

/**
 * HoverPreview - Shows markdown preview on hover with delay
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Trigger element (table row)
 * @param {string} props.markdownContent - Markdown content to preview
 * @param {string} props.title - Conversation title for header
 * @param {number} props.delay - Hover delay in ms (default 500)
 */
export function HoverPreview({ children, markdownContent, title, delay = 500 }) {
  const [open, setOpen] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const openTimeoutRef = useRef(null);
  const closeTimeoutRef = useRef(null);
  const hideTimeoutRef = useRef(null);
  const hoverWithinRef = useRef(false);

  const clearTimer = (timerRef) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const clearAllTimers = () => {
    clearTimer(openTimeoutRef);
    clearTimer(closeTimeoutRef);
    clearTimer(hideTimeoutRef);
  };

  const openPopover = () => {
    setShouldRender(true);
    setOpen(true);
  };

  const scheduleClose = () => {
    clearTimer(closeTimeoutRef);
    closeTimeoutRef.current = setTimeout(() => {
      if (hoverWithinRef.current) return;
      setOpen(false);
      clearTimer(hideTimeoutRef);
      hideTimeoutRef.current = setTimeout(() => {
        if (!hoverWithinRef.current) {
          setShouldRender(false);
        }
      }, 150);
    }, 450);
  };

  // Handle mouse enter with delay
  const handleTriggerMouseEnter = () => {
    hoverWithinRef.current = true;
    clearAllTimers();
    openTimeoutRef.current = setTimeout(() => {
      if (hoverWithinRef.current) {
        openPopover();
      }
    }, delay);
  };

  // Handle mouse leave
  const handleTriggerMouseLeave = () => {
    hoverWithinRef.current = false;
    clearTimer(openTimeoutRef);
    scheduleClose();
  };

  const handleContentMouseEnter = () => {
    hoverWithinRef.current = true;
    clearTimer(closeTimeoutRef);
    clearTimer(hideTimeoutRef);
  };

  const handleContentMouseLeave = () => {
    hoverWithinRef.current = false;
    scheduleClose();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, []);

  const renderTriggerChild = () => {
    if (!isValidElement(children)) {
      return children;
    }

    const { onMouseEnter, onMouseLeave, style, ...restProps } = children.props;

    return cloneElement(children, {
      ...restProps,
      style: { cursor: 'pointer', ...style },
      onMouseEnter: (event) => {
        if (onMouseEnter) {
          onMouseEnter(event);
        }
        handleTriggerMouseEnter();
      },
      onMouseLeave: (event) => {
        if (onMouseLeave) {
          onMouseLeave(event);
        }
        handleTriggerMouseLeave();
      },
    });
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          hoverWithinRef.current = true;
          clearAllTimers();
          openPopover();
        } else {
          hoverWithinRef.current = false;
          clearAllTimers();
          setOpen(false);
          setShouldRender(false);
        }
      }}
    >
      <Popover.Trigger asChild>
        {renderTriggerChild()}
      </Popover.Trigger>

      {shouldRender && (
        <Popover.Portal>
          <Popover.Content
            onMouseEnter={handleContentMouseEnter}
            onMouseLeave={handleContentMouseLeave}
            onEscapeKeyDown={() => {
              setOpen(false);
              setShouldRender(false);
            }}
            className="hover-preview-content"
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 20px 50px -12px rgba(22, 23, 24, 0.5)',
              padding: '20px',
              width: '90vw',
              maxWidth: '800px',
              maxHeight: '85vh',
              overflow: 'auto',
              zIndex: 9999,
              border: '1px solid #e5e7eb',
              animation: 'slideIn 200ms ease-out',
            }}
          >
            {/* Header */}
            <div
              style={{
                borderBottom: '2px solid #e5e7eb',
                paddingBottom: '12px',
                marginBottom: '16px',
                position: 'sticky',
                top: '-20px',
                backgroundColor: 'white',
                zIndex: 1,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#1f2937',
                }}
              >
                Preview: {title}
              </h3>
              <p
                style={{
                  margin: '4px 0 0 0',
                  fontSize: '12px',
                  color: '#6b7280',
                }}
              >
                Hover preview of converted markdown
              </p>
            </div>

            {/* Markdown Content */}
            <div
              className="markdown-preview"
              style={{
                fontSize: '14px',
                lineHeight: '1.6',
                color: '#374151',
              }}
            >
              <ReactMarkdown
                rehypePlugins={[rehypeHighlight]}
                remarkPlugins={[remarkGfm]}
                components={{
                  // Custom renderers for better styling
                  h1: ({ node, ...props }) => (
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '20px', marginBottom: '12px' }} {...props} />
                  ),
                  h2: ({ node, ...props }) => (
                    <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '16px', marginBottom: '10px' }} {...props} />
                  ),
                  h3: ({ node, ...props }) => (
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '14px', marginBottom: '8px' }} {...props} />
                  ),
                  h4: ({ node, ...props }) => (
                    <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '12px', marginBottom: '8px' }} {...props} />
                  ),
                  p: ({ node, ...props }) => (
                    <p style={{ marginBottom: '12px' }} {...props} />
                  ),
                  code: ({ node, inline, ...props }) => (
                    inline ? (
                      <code
                        style={{
                          backgroundColor: '#f3f4f6',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '13px',
                          fontFamily: 'monospace',
                        }}
                        {...props}
                      />
                    ) : (
                      <code {...props} />
                    )
                  ),
                  pre: ({ node, ...props }) => (
                    <pre
                      style={{
                        backgroundColor: '#f6f8fa',
                        padding: '12px',
                        borderRadius: '6px',
                        overflow: 'auto',
                        marginBottom: '12px',
                        fontSize: '13px',
                      }}
                      {...props}
                    />
                  ),
                  blockquote: ({ node, ...props }) => (
                    <blockquote
                      style={{
                        borderLeft: '4px solid #e5e7eb',
                        paddingLeft: '16px',
                        marginLeft: '0',
                        color: '#6b7280',
                        fontStyle: 'italic',
                      }}
                      {...props}
                    />
                  ),
                  ul: ({ node, ...props }) => (
                    <ul style={{ marginBottom: '12px', paddingLeft: '24px' }} {...props} />
                  ),
                  ol: ({ node, ...props }) => (
                    <ol style={{ marginBottom: '12px', paddingLeft: '24px' }} {...props} />
                  ),
                  li: ({ node, ...props }) => (
                    <li style={{ marginBottom: '4px' }} {...props} />
                  ),
                  a: ({ node, ...props }) => (
                    <a
                      style={{ color: '#4f46e5', textDecoration: 'underline' }}
                      target="_blank"
                      rel="noopener noreferrer"
                      {...props}
                    />
                  ),
                }}
              >
                {markdownContent}
              </ReactMarkdown>
            </div>
          </Popover.Content>
        </Popover.Portal>
      )}

      {/* Backdrop overlay - rendered separately outside Popover */}
      {open && shouldRender && typeof document !== 'undefined' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            zIndex: 9998,
            animation: 'fadeIn 150ms ease-out',
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        />
      )}
    </Popover.Root>
  );
}
