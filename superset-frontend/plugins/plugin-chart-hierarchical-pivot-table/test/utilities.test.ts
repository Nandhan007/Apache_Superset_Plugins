import { getCustomSortKey } from '../src/react-pivottable/utilities';

describe('getCustomSortKey', () => {
  it('should return original value if not a string', () => {
    expect(getCustomSortKey(123, true)).toBe(123);
    expect(getCustomSortKey(null, true)).toBe(null);
  });

  it('should sort months correctly', () => {
    expect(getCustomSortKey('Jan', true)).toBe('00-01');
    expect(getCustomSortKey('February', true)).toBe('00-02');
    expect(getCustomSortKey('Dec 2024', true)).toBe('2024-12');
    expect(getCustomSortKey('Jan-25', true)).toBe('2025-01');
  });

  it('should sort quarters correctly', () => {
    expect(getCustomSortKey('Q1', true)).toBe('00-Q1');
    expect(getCustomSortKey('Q3 2023', true)).toBe('2023-Q3');
  });

  it('should sort weeks correctly', () => {
    expect(getCustomSortKey('W1', true)).toBe('00-W01');
    expect(getCustomSortKey('Week 5', true)).toBe('00-W05');
    expect(getCustomSortKey('W52-2024', true)).toBe('2024-W52');
  });
  
  it('should sort seasons correctly', () => {
    expect(getCustomSortKey('Spring', true)).toBe('00-01');
    expect(getCustomSortKey('Summer 2024', true)).toBe('2024-02');
  });

  it('should sort halves correctly', () => {
    expect(getCustomSortKey('H1', true)).toBe('00-H1');
    expect(getCustomSortKey('H2 2024', true)).toBe('2024-H2');
    expect(getCustomSortKey('1st Half 25', true)).toBe('2025-H1');
    expect(getCustomSortKey('2nd Half', true)).toBe('00-H2');
  });

  it('should return original value if no custom sorting match', () => {
    expect(getCustomSortKey('Apple', true)).toBe('Apple');
  });
});

import { naturalSort, isColorDark } from '../src/react-pivottable/utilities';

describe('naturalSort', () => {
  it('should handle numeric and alphabetical sorting correctly', () => {
    expect(naturalSort('a1', 'a2')).toBeLessThan(0);
    expect(naturalSort('a2', 'a1')).toBeGreaterThan(0);
    expect(naturalSort('a10', 'a2')).toBeGreaterThan(0); // 10 comes after 2
    expect(naturalSort('10', '2')).toBeGreaterThan(0);
    expect(naturalSort('00-01', '00-02')).toBeLessThan(0);
    expect(naturalSort('2024-12', '2025-01')).toBeLessThan(0);
    expect(naturalSort('Same', 'Same')).toBe(0);
  });
});

describe('isColorDark', () => {
  it('should correctly identify dark and light colors', () => {
    expect(isColorDark('#000000')).toBe(true); // Black
    expect(isColorDark('#FFFFFF')).toBe(false); // White
    expect(isColorDark('#800000')).toBe(true); // Dark Red
    expect(isColorDark('#FFCCCC')).toBe(false); // Light Red
    expect(isColorDark('#000')).toBe(true); // Short Black
    expect(isColorDark('#FFF')).toBe(false); // Short White
    expect(isColorDark('invalid')).toBe(false);
  });
});

import {
  extractSimpleAggFromJinjaSql,
  extractMetricAggFromTemplatedQuery,
  resolveMetricAggregation,
} from '../src/HierarchicalPivotTable';

describe('extractSimpleAggFromJinjaSql', () => {
  it('should extract simple aggregation from Jinja if/else query', () => {
    const jinjaSql = `
      {% if filter_values('type')[0] == 'avg' %}
        AVG(sales_amount)
      {% else %}
        SUM(sales_amount)
      {% endif %}
    `;
    expect(extractSimpleAggFromJinjaSql(jinjaSql)).toBe('Average');
  });

  it('should ignore Jinja comments that contain aggregation keywords', () => {
    const jinjaSql = `
      {# note: do not use count(distinct user) here #}
      SUM(net_demand_retail)
    `;
    expect(extractSimpleAggFromJinjaSql(jinjaSql)).toBe('Sum');
  });

  it('should extract simple aggregation wrapping Jinja tags', () => {
    const jinjaSql = `AVG({{ filter_values('metric_col')[0] }})`;
    expect(extractSimpleAggFromJinjaSql(jinjaSql)).toBe('Average');
  });

  it('should extract simple aggregation from CASE WHEN containing Jinja expressions', () => {
    const jinjaSql = `
      SUM(CASE WHEN division = '{{ filter_values("division")[0] }}' THEN amount ELSE 0 END)
    `;
    expect(extractSimpleAggFromJinjaSql(jinjaSql)).toBe('Sum');
  });

  it('should extract aggregation declared via Jinja set variable', () => {
    const jinjaSql = `{% set agg = 'average' %} SELECT * FROM table`;
    expect(extractSimpleAggFromJinjaSql(jinjaSql)).toBe('Average');
  });

  it('should extract aggregation from Jinja literal function', () => {
    const jinjaSql = `{{ 'SUM' }}(amount)`;
    expect(extractSimpleAggFromJinjaSql(jinjaSql)).toBe('Sum');
  });

  it('should extract Count Unique Values from COUNT DISTINCT in templated SQL', () => {
    const jinjaSql = `
      COUNT(DISTINCT CASE WHEN flag = 1 THEN {{ 'user_id' }} ELSE NULL END)
    `;
    expect(extractSimpleAggFromJinjaSql(jinjaSql)).toBe('Count Unique Values');
  });

  it('should extract Minimum, Maximum, Median, Variance, Standard Deviation', () => {
    expect(extractSimpleAggFromJinjaSql(`MIN(price * {{ rate }})`)).toBe('Minimum');
    expect(extractSimpleAggFromJinjaSql(`MAX(score)`)).toBe('Maximum');
    expect(extractSimpleAggFromJinjaSql(`MEDIAN(response_time)`)).toBe('Median');
    expect(extractSimpleAggFromJinjaSql(`STDDEV(latency)`)).toBe('Sample Standard Deviation');
    expect(extractSimpleAggFromJinjaSql(`VARIANCE(variance_metric)`)).toBe('Sample Variance');
  });
});

describe('extractMetricAggFromTemplatedQuery', () => {
  const templatedQuery = `
    SELECT
      year,
      brand,
      division,
      SUM(net_demand) AS "Net Demand Retail $",
      AVG(aur) AS "AUR %",
      COUNT(DISTINCT order_id) AS distinct_orders,
      MIN(cost) AS min_cost,
      MAX(cost) AS max_cost
    FROM sales_data
    WHERE 1=1
    {% if filter_values('division') %}
      AND division IN ({{ filter_values('division')|where_in }})
    {% endif %}
    GROUP BY year, brand, division
  `;

  it('should extract matching simple aggregations for metrics from templated query', () => {
    expect(extractMetricAggFromTemplatedQuery('Net Demand Retail $', templatedQuery)).toBe('Sum');
    expect(extractMetricAggFromTemplatedQuery('AUR %', templatedQuery)).toBe('Average');
    expect(extractMetricAggFromTemplatedQuery('distinct_orders', templatedQuery)).toBe('Count Unique Values');
    expect(extractMetricAggFromTemplatedQuery('min_cost', templatedQuery)).toBe('Minimum');
    expect(extractMetricAggFromTemplatedQuery('max_cost', templatedQuery)).toBe('Maximum');
  });

  it('should return null when metric is not found in templated query', () => {
    expect(extractMetricAggFromTemplatedQuery('unknown_metric', templatedQuery)).toBeNull();
  });
});

describe('resolveMetricAggregation with Jinja-templated queries', () => {
  it('should resolve aggregation from templated dataset query when metric has no explicit aggregate', () => {
    const templatedQuery = `
      SELECT
        category,
        AVG(price) AS unit_price
      FROM catalog
      {% if filter_values('category') %}
        WHERE category = '{{ filter_values("category")[0] }}'
      {% endif %}
    `;
    const result = resolveMetricAggregation(
      'unit_price',
      [],
      [],
      [],
      {},
      'Sum',
      templatedQuery,
    );
    expect(result).toBe('Average');
  });

  it('should resolve aggregation when metric sqlExpression contains Jinja templating', () => {
    const adhocMetrics = [
      {
        label: 'Dynamic Metric',
        sqlExpression: `
          {% if filter_values('mode')[0] == 'avg' %}
            AVG(rate)
          {% else %}
            SUM(rate)
          {% endif %}
        `,
      },
    ];
    const result = resolveMetricAggregation(
      'Dynamic Metric',
      adhocMetrics as any,
      [],
      [],
      {},
      'Sum',
    );
    expect(result).toBe('Average');
  });
});
