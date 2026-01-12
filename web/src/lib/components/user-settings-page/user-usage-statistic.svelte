<script lang="ts">
  import { locale } from '$lib/stores/preferences.store';
  import {
    AssetVisibility,
    getAlbumStatistics,
    getAssetStatistics,
    type AlbumStatisticsResponseDto,
    type AssetStatsResponseDto,
  } from '@immich/sdk';
  import { Heading, Stack, Table, TableBody, TableCell, TableHeader, TableHeading, TableRow } from '@immich/ui';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';

  let timelineStats: AssetStatsResponseDto = $state({
    videos: 0,
    images: 0,
    total: 0,
  });

  let favoriteStats: AssetStatsResponseDto = $state({
    videos: 0,
    images: 0,
    total: 0,
  });

  let archiveStats: AssetStatsResponseDto = $state({
    videos: 0,
    images: 0,
    total: 0,
  });

  let trashStats: AssetStatsResponseDto = $state({
    videos: 0,
    images: 0,
    total: 0,
  });

  let albumStats: AlbumStatisticsResponseDto = $state({
    owned: 0,
    shared: 0,
    notShared: 0,
  });

  const getUsage = async () => {
    [timelineStats, favoriteStats, archiveStats, trashStats, albumStats] = await Promise.all([
      getAssetStatistics({ visibility: AssetVisibility.Timeline }),
      getAssetStatistics({ isFavorite: true }),
      getAssetStatistics({ visibility: AssetVisibility.Archive }),
      getAssetStatistics({ isTrashed: true }),
      getAlbumStatistics(),
    ]);
  };

  onMount(async () => {
    await getUsage();
  });
</script>

{#snippet row(viewName: string, stats: AssetStatsResponseDto)}
  <TableRow>
    <TableCell class="w-1/4">{viewName}</TableCell>
    <TableCell class="w-1/4">{stats.images.toLocaleString($locale)}</TableCell>
    <TableCell class="w-1/4">{stats.videos.toLocaleString($locale)}</TableCell>
    <TableCell class="w-1/4">{stats.total.toLocaleString($locale)}</TableCell>
  </TableRow>
{/snippet}

{#snippet card(viewName: string, stats: AssetStatsResponseDto)}
  <Table striped spacing="small" size="small" class="border-0 mt-6">
    <TableHeader>
      <TableHeading>{viewName}</TableHeading>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell class="w-1/2">{$t('photos')}</TableCell>
        <TableCell class="w-1/2">{stats.images.toLocaleString($locale)}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell class="w-1/2">{$t('videos')}</TableCell>
        <TableCell class="w-1/2">{stats.videos.toLocaleString($locale)}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell class="w-1/2">{$t('total')}</TableCell>
        <TableCell class="w-1/2">{stats.total.toLocaleString($locale)}</TableCell>
      </TableRow>
    </TableBody>
  </Table>
{/snippet}

<section class="my-6 block sm:hidden">
  <Stack gap={4}>
    {@render card($t('timeline'), timelineStats)}
    {@render card($t('favorites'), favoriteStats)}
    {@render card($t('archive'), archiveStats)}
    {@render card($t('trash'), trashStats)}
  </Stack>
</section>

<section class="my-6 w-full hidden sm:block">
  <Heading size="tiny">{$t('photos_and_videos')}</Heading>
  <Table striped spacing="medium" class="mt-4">
    <TableHeader>
      <TableHeading class="w-1/4">{$t('view_name')}</TableHeading>
      <TableHeading class="w-1/4">{$t('photos')}</TableHeading>
      <TableHeading class="w-1/4">{$t('videos')}</TableHeading>
      <TableHeading class="w-1/4">{$t('total')}</TableHeading>
    </TableHeader>
    <TableBody>
      {@render row($t('timeline'), timelineStats)}
      {@render row($t('favorites'), favoriteStats)}
      {@render row($t('archive'), archiveStats)}
      {@render row($t('trash'), trashStats)}
    </TableBody>
  </Table>

  <Heading size="tiny" class="mt-8">{$t('albums')}</Heading>
  <Table striped spacing="medium" class="mt-4">
    <TableHeader>
      <TableHeading class="w-1/2">{$t('owned')}</TableHeading>
      <TableHeading class="w-1/2">{$t('shared')}</TableHeading>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell class="w-1/2">{albumStats.owned.toLocaleString($locale)}</TableCell>
        <TableCell class="w-1/2">{albumStats.shared.toLocaleString($locale)}</TableCell>
      </TableRow>
    </TableBody>
  </Table>
</section>
