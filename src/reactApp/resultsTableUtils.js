const SORT_FIELDS = {
  TITLE: 'title',
  CREATED: 'created',
};

function normalizeTitle(value) {
  return (value || '').toString().toLowerCase();
}

function getTimestamp(file) {
  if (typeof file?.createTime === 'number' && !Number.isNaN(file.createTime)) {
    return file.createTime;
  }

  const parsed = Date.parse(file?.createdDate || '');
  if (!Number.isNaN(parsed)) {
    return Math.floor(parsed / 1000);
  }
  return 0;
}

export function sortFiles(files, field, direction) {
  const dir = direction === 'asc' ? 1 : -1;
  return [...files].sort((a, b) => {
    if (field === SORT_FIELDS.TITLE) {
      const aTitle = normalizeTitle(a?.title);
      const bTitle = normalizeTitle(b?.title);
      if (aTitle === bTitle) return 0;
      return aTitle > bTitle ? dir : -dir;
    }

    const aTime = getTimestamp(a);
    const bTime = getTimestamp(b);
    if (aTime === bTime) return 0;
    return aTime > bTime ? dir : -dir;
  });
}

export function getPaginatedFiles(files, currentPage, itemsPerPage) {
  const safePage = Math.max(1, currentPage);
  const start = (safePage - 1) * itemsPerPage;
  return files.slice(start, start + itemsPerPage);
}

export function buildPageList(currentPage, totalPages, maxVisible = 7) {
  if (totalPages <= 1) return [1];

  const pages = [];
  const limitedTotal = Math.max(totalPages, 1);
  const clampedCurrent = Math.min(Math.max(currentPage, 1), limitedTotal);

  if (limitedTotal <= maxVisible) {
    for (let i = 1; i <= limitedTotal; i += 1) {
      pages.push(i);
    }
    return pages;
  }

  pages.push(1);

  const showLeadingEllipsis = clampedCurrent > 3;
  const showTrailingEllipsis = clampedCurrent < limitedTotal - 2;

  const start = Math.max(2, clampedCurrent - 1);
  const end = Math.min(limitedTotal - 1, clampedCurrent + 1);

  if (showLeadingEllipsis) {
    pages.push('...');
  }

  for (let i = start; i <= end; i += 1) {
    pages.push(i);
  }

  if (showTrailingEllipsis) {
    pages.push('...');
  }

  pages.push(limitedTotal);

  return pages;
}

export { SORT_FIELDS };
