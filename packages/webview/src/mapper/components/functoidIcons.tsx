/**
 * Functoid Icon Mapping - Maps functoid kinds to Lucide React icons
 */

import {
  Plus,
  Minus,
  X,
  Divide,
  Percent,
  Superscript,
  Binary,
  ArrowUpToLine,
  ArrowDownToLine,
  Circle,
  Radical,
  FlipVertical2,
  Link,
  CaseSensitive,
  CaseUpper,
  Scissors,
  Hash,
  Slice,
  Replace,
  Split,
  Combine,
  GitBranch,
  GitMerge,
  Ban,
  Equal,
  XCircle,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  List,
  Filter,
  BarChart3,
  Sparkles,
  ArrowUpCircle,
  ArrowDownCircle,
  Sigma,
  TrendingUp,
  TrendingDown,
  Type,
  Hash as HashIcon,
  CheckCircle,
  ListTree,
  Braces,
  Brackets,
  Clock,
  CalendarDays,
  CalendarCheck,
  CalendarPlus,
  CalendarClock,
  Box,
  Code2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { NodeKind } from '../../../../core/src/mapper/types';

/**
 * Icon mapping for all functoid types
 */
export const functoidIconMap: Record<NodeKind, LucideIcon> = {
  // Math functoids
  'Binary.Add': Plus,
  'Binary.Subtract': Minus,
  'Binary.Multiply': X,
  'Binary.Divide': Divide,
  'Binary.Modulo': Percent,
  'Binary.Power': Superscript,
  'Unary.Abs': Binary,
  'Unary.Ceil': ArrowUpToLine,
  'Unary.Floor': ArrowDownToLine,
  'Unary.Round': Circle,
  'Unary.Sqrt': Radical,
  'Unary.Negate': FlipVertical2,

  // String functoids
  'String.Concat': Link,
  'String.Uppercase': CaseUpper,
  'String.Lowercase': CaseSensitive,
  'String.Trim': Scissors,
  'String.Length': Hash,
  'String.Substring': Slice,
  'String.Replace': Replace,
  'String.Split': Split,
  'String.Join': Combine,
  'String.Template': Braces,

  // Logical functoids
  'Binary.And': GitBranch,
  'Binary.Or': GitMerge,
  'Unary.Not': Ban,
  'Binary.Equal': Equal,
  'Binary.NotEqual': XCircle,
  'Binary.LessThan': ChevronLeft,
  'Binary.LessThanOrEqual': ChevronDown,
  'Binary.GreaterThan': ChevronRight,
  'Binary.GreaterThanOrEqual': ChevronUp,

  // Conditional functoids
  'Conditional.If': HelpCircle,
  'Conditional.Switch': List,
  'Conditional.DefaultValue': Filter,

  // Collection functoids
  'Collection.Map': BarChart3,
  'Collection.Filter': Filter,
  'Collection.Count': Hash,
  'Collection.Distinct': Sparkles,
  'Collection.Sort': ArrowUpCircle,
  'Collection.Reverse': ArrowDownCircle,
  'Collection.Flatten': ListTree,

  // Aggregate functoids
  'Aggregate.Sum': Sigma,
  'Aggregate.Average': TrendingUp,
  'Aggregate.Min': TrendingDown,
  'Aggregate.Max': TrendingUp,
  'Aggregate.Count': HashIcon,

  // Conversion functoids
  'Convert.ToString': Type,
  'Convert.ToNumber': Hash,
  'Convert.ToBoolean': CheckCircle,
  'Convert.ToInteger': Hash,
  'Convert.ToArray': Brackets,
  'Convert.ToDate': CalendarCheck,
  'Convert.ParseJSON': Braces,
  'Convert.StringifyJSON': Braces,

  // DateTime functoids
  'DateTime.Now': Clock,
  'DateTime.Format': CalendarDays,
  'DateTime.Parse': CalendarCheck,
  'DateTime.AddDays': CalendarPlus,
  'DateTime.AddMonths': CalendarPlus,
  'DateTime.Diff': CalendarClock,

  // Custom functoids
  'Const.Value': Box,
  'Custom.Function': Code2
};

/**
 * Get icon component for a functoid kind
 */
export function getFunctoidIcon(kind: NodeKind): LucideIcon {
  return functoidIconMap[kind] || Code2;
}
