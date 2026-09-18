import React, { useState } from 'react';
import { Tooltip, message } from 'antd';

export interface CellTooltipProps {
  formattedValue?: any;
  rawValue?: any;
  title?: string;
  isPercentage?: boolean;
  children: React.ReactNode;
}

const formatValueRounded = (val: any, isPercentage?: boolean) => {
  if (val === undefined || val === null || val === '') return '';
  const num = Number(val);
  if (!isNaN(num)) {
    if (isPercentage) {
      const scaled = Number((num * 100).toFixed(6));
      const rounded2 = Number(scaled.toFixed(2));
      if (rounded2 % 1 === 0) {
        return `${rounded2}%`;
      }
      return `${scaled.toFixed(2)}%`;
    }
    const rounded2 = Number(num.toFixed(2));
    if (rounded2 % 1 === 0) {
      return String(rounded2);
    }
    return num.toFixed(2);
  }
  return String(val);
};

export const CellTooltip: React.FC<CellTooltipProps> = ({
  formattedValue,
  rawValue,
  isPercentage,
  children,
}) => {
  const [copied, setCopied] = useState(false);

  const targetVal =
    rawValue !== undefined && rawValue !== null ? rawValue : formattedValue;
  const rawValStr = formatValueRounded(targetVal, isPercentage);

  if (!rawValStr) {
    return <>{children}</>;
  }

  const fallbackCopy = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      setCopied(true);
      message.success(`Copied "${text}" to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy fallback failed:', err);
    }
    document.body.removeChild(textArea);
  };

  const handleDirectCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const textToCopy = rawValStr;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy).then(
        () => {
          setCopied(true);
          message.success(`Copied "${textToCopy}" to clipboard`);
          setTimeout(() => setCopied(false), 2000);
        },
        () => {
          fallbackCopy(textToCopy);
        },
      );
    } else {
      fallbackCopy(textToCopy);
    }
  };

  const tooltipOverlay = (
    <div
      onClick={handleDirectCopy}
      title={copied ? 'Copied!' : 'Click to copy value'}
      style={{
        userSelect: 'text',
        cursor: 'pointer',
        fontWeight: 500,
        fontSize: '12px',
        padding: '1px 2px',
      }}
    >
      {rawValStr}
    </div>
  );

  return (
    <Tooltip
      title={tooltipOverlay}
      placement="top"
      mouseEnterDelay={0.15}
      arrowPointAtCenter={false}
      align={{ offset: [0, -2] }}
      overlayInnerStyle={{
        userSelect: 'text',
        padding: '3px 7px',
        borderRadius: '4px',
        cursor: 'pointer',
      }}
    >
      <span style={{ display: 'inline-block', maxWidth: '100%' }}>
        {children}
      </span>
    </Tooltip>
  );
};

export default CellTooltip;
