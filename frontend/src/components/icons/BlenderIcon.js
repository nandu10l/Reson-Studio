import React from 'react';

/**
 * BlenderIcon - Wrapper component that styles any icon library icon to look like Blender icons
 * 
 * Features:
 * - Monochrome filled silhouettes
 * - Thick, rounded geometric shapes
 * - Optimized for 16-24px sizes
 * - Neutral gray default, accent blue for active states
 * - Professional dark theme styling
 */
export const BlenderIcon = ({ 
  icon: IconComponent, 
  size = 16, 
  color = '#b3b3b3',
  active = false,
  className = '',
  style = {},
  ...props 
}) => {
  if (!IconComponent) return null;

  const iconColor = active ? '#60a5fa' : color;
  
  return (
    <IconComponent
      size={size}
      color={iconColor}
      strokeWidth={2.5}
      fill={active ? iconColor : 'none'}
      className={`blender-icon ${className}`}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        transition: 'all 0.2s ease',
        ...style
      }}
      {...props}
    />
  );
};

export default BlenderIcon;

