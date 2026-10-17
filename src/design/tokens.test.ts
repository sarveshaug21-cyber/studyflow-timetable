import { describe, it, expect } from 'vitest';
import { brand, neutral, semantic, surface, radius, shadow, motion, type as typeScale, grid, fontFamily } from '@/design/tokens';

describe('brand color tokens', () => {
  it('defines a complete brand scale', () => {
    expect(brand).toHaveProperty('50');
    expect(brand).toHaveProperty('100');
    expect(brand).toHaveProperty('500');
    expect(brand).toHaveProperty('900');
    expect(brand).toHaveProperty('950');
  });

  it('uses valid hex color values', () => {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    Object.values(brand).forEach((color) => {
      expect(color).toMatch(hexRegex);
    });
  });

  it('has brand-600 as the primary accent', () => {
    expect(brand['600']).toBe('#006fc7');
  });
});

describe('neutral color tokens', () => {
  it('defines a complete neutral scale', () => {
    expect(neutral).toHaveProperty('50');
    expect(neutral).toHaveProperty('100');
    expect(neutral).toHaveProperty('900');
    expect(neutral).toHaveProperty('950');
  });

  it('uses valid hex color values', () => {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    Object.values(neutral).forEach((color) => {
      expect(color).toMatch(hexRegex);
    });
  });

  it('has light-to-dark progression', () => {
    expect(neutral['50']).toBe('#fafafa');
    expect(neutral['950']).toBe('#09090b');
  });
});

describe('semantic color tokens', () => {
  it('defines success, error, warning, info roles', () => {
    expect(semantic).toHaveProperty('success');
    expect(semantic).toHaveProperty('error');
    expect(semantic).toHaveProperty('warning');
    expect(semantic).toHaveProperty('info');
  });

  it('each role has bg, border, text classes', () => {
    Object.values(semantic).forEach((role) => {
      expect(role.bg).toContain('bg-');
      expect(role.border).toContain('border-');
      expect(role.text).toContain('text-');
    });
  });
});

describe('surface tokens', () => {
  it('defines surface color roles', () => {
    expect(surface).toHaveProperty('body');
    expect(surface).toHaveProperty('card');
    expect(surface).toHaveProperty('elevated');
    expect(surface).toHaveProperty('secondary');
    expect(surface).toHaveProperty('muted');
  });

  it('each surface has light and dark values', () => {
    Object.values(surface).forEach((surfaceColor) => {
      expect(surfaceColor.light).toBeDefined();
      expect(surfaceColor.dark).toBeDefined();
    });
  });
});

describe('radius tokens', () => {
  it('defines border radius values', () => {
    expect(radius).toHaveProperty('sm');
    expect(radius).toHaveProperty('md');
    expect(radius).toHaveProperty('lg');
    expect(radius).toHaveProperty('xl');
    expect(radius).toHaveProperty('2xl');
    expect(radius).toHaveProperty('full');
  });

  it('uses valid CSS length values', () => {
    Object.values(radius).forEach((value) => {
      expect(value).toMatch(/^\d+(\.\d+)?(px|rem|em|%)$/);
    });
  });
});

describe('shadow tokens', () => {
  it('defines shadow values', () => {
    expect(shadow).toHaveProperty('subtle');
    expect(shadow).toHaveProperty('card');
    expect(shadow).toHaveProperty('elevated');
    expect(shadow).toHaveProperty('modal');
  });

  it('uses valid box-shadow CSS values', () => {
    Object.values(shadow).forEach((value) => {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    });
  });
});

describe('motion tokens', () => {
  it('defines motion timing values', () => {
    expect(motion).toHaveProperty('fast');
    expect(motion).toHaveProperty('normal');
    expect(motion).toHaveProperty('slow');
  });

  it('uses valid duration values', () => {
    const durationValues = [
      motion.fast,
      motion.normal,
      motion.slow,
    ];
    durationValues.forEach((value) => {
      expect(value).toMatch(/^\d+ms$/);
    });
  });
});

describe('type scale tokens', () => {
  it('defines typography scale', () => {
    expect(typeScale).toHaveProperty('2xs');
    expect(typeScale).toHaveProperty('sm');
    expect(typeScale).toHaveProperty('base');
    expect(typeScale).toHaveProperty('lg');
    expect(typeScale).toHaveProperty('xl');
    expect(typeScale).toHaveProperty('2xl');
  });
});

describe('grid tokens', () => {
  it('defines grid layout constants', () => {
    expect(grid).toHaveProperty('pixelsPerHour');
    expect(grid).toHaveProperty('headerHeight');
    expect(grid).toHaveProperty('timeAxisWidth');
    expect(grid).toHaveProperty('minBlockHeight');
    expect(grid).toHaveProperty('allDayStripHeight');
  });

  it('has sensible default values', () => {
    expect(grid.pixelsPerHour).toBe(60);
    expect(grid.headerHeight).toBe(40);
    expect(grid.timeAxisWidth).toBe(60);
    expect(grid.minBlockHeight).toBe(32);
    expect(grid.allDayStripHeight).toBe(40);
  });
});

describe('font family tokens', () => {
  it('defines sans and mono font families', () => {
    expect(fontFamily).toHaveProperty('sans');
    expect(fontFamily).toHaveProperty('mono');
  });

  it('includes Inter as primary sans font', () => {
    expect(fontFamily.sans[0]).toBe('Inter');
  });
});
