import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Section, SectionHeader } from '@/components/ui/Section';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Hello card</Card>);
    expect(screen.getByText('Hello card')).toBeInTheDocument();
  });

  it('supports elevated variant', () => {
    render(<Card variant="elevated">Elevated card</Card>);
    expect(screen.getByText('Elevated card')).toBeInTheDocument();
  });

  it('renders Card sub-components', () => {
    render(
      <Card>
        <Card.Header>
          <Card.Title>Card title</Card.Title>
          <Card.Description>Card description</Card.Description>
        </Card.Header>
        <Card.Body>Card body</Card.Body>
        <Card.Footer>Card footer</Card.Footer>
      </Card>,
    );
    expect(screen.getByText('Card title')).toBeInTheDocument();
    expect(screen.getByText('Card description')).toBeInTheDocument();
    expect(screen.getByText('Card body')).toBeInTheDocument();
    expect(screen.getByText('Card footer')).toBeInTheDocument();
  });
});

describe('Badge', () => {
  it('renders with default variant', () => {
    render(<Badge>Default badge</Badge>);
    expect(screen.getByText('Default badge')).toBeInTheDocument();
  });

  it('renders with semantic variants', () => {
    render(
      <>
        <Badge variant="success">Success</Badge>
        <Badge variant="error">Error</Badge>
        <Badge variant="warning">Warning</Badge>
        <Badge variant="brand">Brand</Badge>
      </>,
    );
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.getByText('Brand')).toBeInTheDocument();
  });
});

describe('Section', () => {
  it('renders children with section padding', () => {
    render(<Section>Section content</Section>);
    expect(screen.getByText('Section content')).toBeInTheDocument();
  });

  it('renders SectionHeader with title and description', () => {
    render(
      <Section>
        <SectionHeader title="Section title" description="Section description" />
      </Section>,
    );
    expect(screen.getByText('Section title')).toBeInTheDocument();
    expect(screen.getByText('Section description')).toBeInTheDocument();
  });

  it('renders Section with Header and Body sub-components', () => {
    render(
      <Section padded={false}>
        <Section.Header>
          <SectionHeader title="Header title" />
        </Section.Header>
        <Section.Body>Section body content</Section.Body>
      </Section>,
    );
    expect(screen.getByText('Header title')).toBeInTheDocument();
    expect(screen.getByText('Section body content')).toBeInTheDocument();
  });
});
