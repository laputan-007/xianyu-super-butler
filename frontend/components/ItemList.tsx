import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Box,
  CirclePause,
  Edit,
  Loader2,
  ListChecks,
  PackageCheck,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  Settings2,
  Send,
  ShoppingBag,
  Sparkles,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  AccountDetail,
  Card,
  Item,
  ItemDeliveryConfigSummary,
  ShippingRule,
} from '../types';
import {
  createManualItem,
  deleteItem,
  deleteShippingRule,
  getAccountDetails,
  getCards,
  getItemDeliveryConfig,
  getItemDeliveryConfigs,
  getItems,
  getShippingRules,
  saveItemDeliveryConfig,
  polishItems,
  syncItemsFromAccount,
  downshelfItem,
  fetchPublishAddresses,
  platformDeleteItem,
  publishItemImage,
  publishItemToXianyu,
  publishLocalItem,
  recommendPublishCategory,
  republishItem,
  updateItemInfo,
  updateItemMultiQuantity,
  updateShippingRule,
  uploadImage,
} from '../services/api';
import { confirmAction } from '../services/feedback';
import DeliveryProtection from './DeliveryProtection';
import GeneralDeliveryRules from './GeneralDeliveryRules';
import {EmptyState, NoticeBanner, PageHeader, PageLoading, PageTabs} from './ui';

type Notice = { type: 'success' | 'error'; message: string } | null;
type ItemSection = 'products' | 'rules' | 'protection';

interface DeliveryVariantForm {
  clientId: string;
  displayName: string;
  specText: string;
  platformSkuId: string;
  cardId: string;
  deliveryCount: number;
  enabled: boolean;
}

interface DeliveryForm {
  enabled: boolean;
  isMultiSpec: boolean;
  variants: DeliveryVariantForm[];
}

interface ManualItemForm {
  cookieId: string;
  itemId: string;
  title: string;
  price: string;
  imageUrl: string;
  description: string;
  detail: string;
}

const emptyManualItem: ManualItemForm = {
  cookieId: '',
  itemId: '',
  title: '',
  price: '',
  imageUrl: '',
  description: '',
  detail: '',
};

const createEmptyVariant = (index = 0): DeliveryVariantForm => ({
  clientId: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
  displayName: '',
  specText: '',
  platformSkuId: '',
  cardId: '',
  deliveryCount: 1,
  enabled: true,
});

const itemKey = (item: Pick<Item, 'cookie_id' | 'item_id'>) =>
  `${item.cookie_id}:${item.item_id}`;

const formatPrice = (price?: string) => {
  const value = price?.trim().replace(/^[¥￥]\s*/, '');
  return value ? `¥${value}` : '价格未知';
};

const normalizeImageUrl = (url?: string) => {
  const value = url?.trim();
  if (!value) return '';
  return value.startsWith('//') ? `https:${value}` : value;
};

/** 图片字段：URL 输入 + 本地上传按钮 + 缓略图预览，编辑与手动添加弹窗共用。 */
const ImageField: React.FC<{
  id: string;
  value: string;
  uploading: boolean;
  onChange: (value: string) => void;
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ id, value, uploading, onChange, onUpload }) => {
  const previewSrc = normalizeImageUrl(value);
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-gray-700" htmlFor={id}>商品图片</label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          value={value}
          onChange={event => onChange(event.target.value)}
          className="ios-input min-w-0 flex-1 rounded-md px-3 py-2.5"
          placeholder="粘贴图片地址，或点右侧按钮上传"
        />
        <label
          className={`ios-btn-secondary flex h-[42px] cursor-pointer items-center justify-center gap-2 rounded-md px-3 text-sm ${
            uploading ? 'pointer-events-none opacity-70' : ''
          }`}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          <span className="hidden sm:inline">上传图片</span>
          <span className="sm:hidden">上传</span>
          <input type="file" accept="image/*" className="hidden" onChange={onUpload} disabled={uploading} />
        </label>
      </div>
      {previewSrc && (
        <div className="mt-2 flex items-center gap-3">
          <img
            src={previewSrc}
            alt="商品图片预览"
            className="h-16 w-16 rounded-md border border-gray-200 bg-gray-100 object-cover"
            referrerPolicy="no-referrer"
          />
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-xs font-bold text-red-500 hover:underline"
          >
            移除图片
          </button>
        </div>
      )}
    </div>
  );
};

const cardTypeLabels: Record<Card['type'], string> = {
  api: 'API 动态内容',
  text: '固定文本',
  data: '批量库存',
  image: '图片内容',
};

const getCardStockLabel = (card?: Card) => {
  if (!card) return '尚未选择发货库存';
  if (!card.enabled) return '该库存已停用';
  if (card.type === 'data') {
    const count = (card.data_content || '').split(/\r?\n/).filter(line => line.trim()).length;
    return `当前可用 ${count} 条`;
  }
  return cardTypeLabels[card.type];
};

/** 弹窗内嵌通知：弹窗打开期间页面级横幅会被遮罩盖住，提示必须渲染进弹窗才可见。 */
const ModalNotice: React.FC<{ notice: Notice; onClose: () => void }> = ({ notice, onClose }) => (
  notice ? (
    <div className="mb-4">
      <NoticeBanner type={notice.type} message={notice.message} onClose={onClose} />
    </div>
  ) : null
);

const ItemImage: React.FC<{ item: Item }> = ({ item }) => {
  const src = normalizeImageUrl(item.item_image);
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center text-gray-400">
        <Box className="h-8 w-8" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={item.item_title || '商品图片'}
      className="h-full w-full object-cover"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
};

const Toggle: React.FC<{
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: () => void;
}> = ({ checked, disabled, label, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 flex-none items-center rounded-full transition-colors ${
      checked ? 'bg-brand' : 'bg-[#e8dcbc]'
    } disabled:cursor-not-allowed disabled:opacity-50`}
  >
    <span
      className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

const ItemList: React.FC<{ syncedAccountId?: string; onSyncedAccountChange?: (id: string) => void }> = ({ syncedAccountId, onSyncedAccountChange }) => {
  const [items, setItems] = useState<Item[]>([]);
  const [accounts, setAccounts] = useState<AccountDetail[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [shippingRules, setShippingRules] = useState<ShippingRule[]>([]);
  const [deliveryConfigs, setDeliveryConfigs] = useState<ItemDeliveryConfigSummary[]>([]);
  const [activeSection, setActiveSection] = useState<ItemSection>('products');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [polishing, setPolishing] = useState(false);
  // 商品列表按账号过滤，多账号时避免混在一起看不清归属
  const [listAccountFilter, setListAccountFilter] = useState('');
  // 顶栏切换「管理的账号」后，发货配置账号与商品列表筛选一并跟随
  useEffect(() => {
    if (!syncedAccountId) return;
    const next = (current: string) => (current === syncedAccountId ? current : syncedAccountId);
    setSelectedAccount(next);
    setListAccountFilter(next);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncedAccountId]);
  // 商品分页
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [savingKey, setSavingKey] = useState('');
  const [notice, setNotice] = useState<Notice>(null);

  const [detailItem, setDetailItem] = useState<Item | null>(null);
  // 商品编辑表单：详情弹窗已升级为全字段编辑（标题/价格/简介/图片/本地详情）
  const [editForm, setEditForm] = useState({ title: '', price: '', description: '', imageUrl: '', detail: '' });
  // 图片上传中的态（编辑弹窗与手动添加弹窗共用）
  const [imageUploading, setImageUploading] = useState(false);
  const [deliveryItem, setDeliveryItem] = useState<Item | null>(null);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState<DeliveryForm>({
    enabled: true,
    isMultiSpec: false,
    variants: [createEmptyVariant()],
  });
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState<ManualItemForm>(emptyManualItem);

  // 商品发布（mtop 直连）：表单 → 识别分类 → 人工确认 → 上架
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishForm, setPublishForm] = useState<{
    cookieId: string;
    title: string;
    price: string;
    originalPrice: string;
    shippingMode: 'free' | 'freight' | 'self';
    images: Array<{ url: string; widthSize: number; heightSize: number; preview: string }>;
    address: Record<string, string> | null;
  }>({ cookieId: '', title: '', price: '', originalPrice: '', shippingMode: 'free', images: [], address: null });
  const [addressOptions, setAddressOptions] = useState<Array<Record<string, string>>>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [publishConfirm, setPublishConfirm] = useState<{
    /** 当前选中的分类（完整对象，发布时原样传给后端） */
    category: Record<string, string>;
    candidates: Array<Record<string, string>>;
  } | null>(null);
  // 发布表单内联校验：错误直接标在对应输入框下方，而不是页面级横幅
  const [publishFieldErrors, setPublishFieldErrors] = useState<{
    cookieId?: string;
    title?: string;
    price?: string;
    originalPrice?: string;
    images?: string;
  }>({});
  const [publishing, setPublishing] = useState(false);
  const [publishUploading, setPublishUploading] = useState(false);

  const accountNames = useMemo(
    () => new Map(accounts.map(account => [
      account.id,
      account.nickname || account.remark || `账号 ${account.id.substring(0, 6)}`,
    ])),
    [accounts],
  );

  const accountAvatars = useMemo(
    () => new Map(accounts.map(account => [account.id, account.avatar_url || ''])),
    [accounts],
  );

  const ruleMap = useMemo(() => {
    const map = new Map<string, ShippingRule>();
    shippingRules.forEach(rule => {
      if (rule.cookie_id && rule.item_id) {
        map.set(`${rule.cookie_id}:${rule.item_id}`, rule);
      }
    });
    return map;
  }, [shippingRules]);

  const genericRules = useMemo(
    () => shippingRules.filter(rule => !rule.item_id),
    [shippingRules],
  );

  const deliveryConfigMap = useMemo(
    () => new Map(deliveryConfigs.map(config => [
      `${config.cookie_id}:${config.item_id}`,
      config,
    ])),
    [deliveryConfigs],
  );

  // 下架商品默认藏起来：它们和在售的混在一起会让人误以为还能卖，
  // 但不能直接删 —— 专属发货配置挂在商品上，重新上架还要接着用。
  const [showOffShelf, setShowOffShelf] = useState(false);

  const isOffShelf = (item: Item) => item.listing_status === 'off_shelf';

  // 本地草稿（手动添加、从未同步）：同步必盖 last_seen_at，手动商品没有
  const isLocalDraft = (item: Item) => !item.last_seen_at;

  const accountScopedItems = useMemo(
    () => (listAccountFilter ? items.filter(item => item.cookie_id === listAccountFilter) : items),
    [items, listAccountFilter],
  );

  const offShelfCount = useMemo(
    () => accountScopedItems.filter(isOffShelf).length,
    [accountScopedItems],
  );

  const visibleItems = useMemo(
    // 草稿即使被同步误标“已下架”也保持可见——它从未在平台上架过
    () => (showOffShelf ? accountScopedItems : accountScopedItems.filter(item => !isOffShelf(item) || isLocalDraft(item))),
    [accountScopedItems, showOffShelf],
  );

  // 商品数据由后端一次性返回，这里做客户端分页：商品多时一屏几十行难以浏览
  const totalPages = Math.max(1, Math.ceil(visibleItems.length / pageSize));
  const pagedItems = useMemo(
    () => visibleItems.slice((page - 1) * pageSize, page * pageSize),
    [visibleItems, page, pageSize],
  );

  // 筛选变化或数据减少导致当前页越界时回到第一页
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const configuredItemCount = useMemo(() => {
    const configuredKeys = new Set(
      deliveryConfigs.map(config => `${config.cookie_id}:${config.item_id}`),
    );
    shippingRules.forEach(rule => {
      if (rule.cookie_id && rule.item_id) {
        configuredKeys.add(`${rule.cookie_id}:${rule.item_id}`);
      }
    });
    return configuredKeys.size;
  }, [deliveryConfigs, shippingRules]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [accountData, itemData, cardData, ruleData, configData] = await Promise.all([
        getAccountDetails(),
        getItems(),
        getCards(),
        getShippingRules(),
        getItemDeliveryConfigs(),
      ]);
      setAccounts(accountData);
      setItems(itemData);
      setCards(cardData);
      setShippingRules(ruleData);
      setDeliveryConfigs(configData);
      setSelectedAccount(current => current || syncedAccountId || accountData[0]?.id || '');
    } catch (error) {
      setNotice({
        type: 'error',
        message: error instanceof Error ? error.message : '商品数据加载失败',
      });
    } finally {
      setLoading(false);
    }
  };

  const reloadRules = async () => {
    const rules = await getShippingRules();
    setShippingRules(rules);
  };

  const reloadDeliveryConfigs = async () => {
    setDeliveryConfigs(await getItemDeliveryConfigs());
  };

  useEffect(() => {
    void loadData();

    // App 用 hidden 属性切换页面，组件挂载后不会卸载，只在挂载时拉一次的话，
    // 在别的页面新增账号或卡密后，这里的下拉框始终是旧数据，必须刷新浏览器才更新。
    const syncSharedData = () => {
      getAccountDetails().then(setAccounts).catch(() => undefined);
      getCards().then(setCards).catch(() => undefined);
      getItemDeliveryConfigs().then(setDeliveryConfigs).catch(() => undefined);
    };

    // 兜底轮询
    const timer = setInterval(syncSharedData, 30000);

    // 切回本页时立即同步：刚在卡密库存加完卡密就切过来的场景，等 30 秒太久。
    // hidden 切换不触发挂载，因此监听自身可见性变化。
    const node = rootRef.current;
    let observer: IntersectionObserver | undefined;
    if (node) {
      observer = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) syncSharedData();
      });
      observer.observe(node);
    }

    return () => {
      clearInterval(timer);
      observer?.disconnect();
    };
  }, []);

  const handleSync = async () => {
    if (!selectedAccount) {
      setNotice({ type: 'error', message: '请先选择需要同步的账号' });
      return;
    }

    setSyncing(true);
    setNotice(null);
    try {
      const result = await syncItemsFromAccount(selectedAccount);
      if (result?.success === false) throw new Error(result.message || '同步失败');
      setItems(await getItems());
      setNotice({ type: 'success', message: result?.message || '商品同步完成' });
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : '同步失败' });
    } finally {
      setSyncing(false);
    }
  };

  // 擦亮把商品重新推到搜索前列，平台对每日次数有限制，超出的会在结果里标记失败
  const handlePolish = async () => {
    setPolishing(true);
    setNotice(null);
    try {
      const result = await polishItems(selectedAccount || undefined);
      if (result?.success === false) throw new Error(result.message || '擦亮失败');
      setNotice({ type: 'success', message: result?.message || '商品擦亮完成' });
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : '擦亮失败' });
    } finally {
      setPolishing(false);
    }
  };

  const openManualModal = () => {
    setNotice(null);
    setManualForm({ ...emptyManualItem, cookieId: selectedAccount || accounts[0]?.id || '' });
    setShowManualModal(true);
  };

  const handleCreateManualItem = async () => {
    if (!manualForm.cookieId || !manualForm.itemId.trim() || !manualForm.title.trim()) {
      setNotice({ type: 'error', message: '账号、商品 ID 和商品标题为必填项' });
      return;
    }

    setSavingKey('manual-item');
    try {
      await createManualItem({
        cookie_id: manualForm.cookieId,
        item_id: manualForm.itemId.trim(),
        title: manualForm.title.trim(),
        price: manualForm.price.trim(),
        image_url: manualForm.imageUrl.trim(),
        description: manualForm.description.trim(),
        detail: manualForm.detail.trim(),
      });
      setItems(await getItems());
      setShowManualModal(false);
      setNotice({ type: 'success', message: '商品已添加，可继续配置自动发货' });
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : '商品添加失败' });
    } finally {
      setSavingKey('');
    }
  };

  const openDetail = (item: Item) => {
    setNotice(null);
    setDetailItem(item);
    setEditForm({
      title: item.item_title || '',
      price: item.item_price || '',
      description: item.item_description || '',
      imageUrl: item.item_image || '',
      detail: item.item_detail || '',
    });
  };

  // ---- 商品发布 ----

  const loadPublishAddresses = async (cookieId: string) => {
    if (!cookieId) {
      setAddressOptions([]);
      return;
    }
    setAddressLoading(true);
    try {
      const res = await fetchPublishAddresses(cookieId);
      const options: Array<Record<string, string>> = [];
      const seen = new Set<string>();
      for (const addr of [res.data.selectedPoi, ...(res.data.commonAddresses || [])]) {
        if (!addr || seen.has(String(addr.poiId))) continue;
        seen.add(String(addr.poiId));
        options.push(addr);
      }
      setAddressOptions(options);
      return options;
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : '地址获取失败' });
      return [];
    } finally {
      setAddressLoading(false);
    }
  };

  const openPublishModal = () => {
    setPublishConfirm(null);
    setNotice(null);
    const cookieId = selectedAccount || accounts[0]?.id || '';
    setPublishForm({
      cookieId,
      title: '',
      price: '',
      originalPrice: '',
      shippingMode: 'free',
      images: [],
      address: null,
    });
    setShowPublishModal(true);
    void loadPublishAddresses(cookieId).then(options => {
      if (options.length) {
        setPublishForm(current => (current.cookieId === cookieId && !current.address
          ? { ...current, address: options[0] }
          : current));
      }
    });
  };

  const handlePublishImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const remain = 9 - publishForm.images.length;
    const picked = files.slice(0, remain);
    if (picked.length < files.length) {
      setNotice({ type: 'error', message: '闲鱼最多支持 9 张商品图片' });
    }
    if (!picked.length) return;
    if (!publishForm.cookieId) {
      setNotice({ type: 'error', message: '请先选择要发布的账号' });
      return;
    }
    setPublishUploading(true);
    try {
      for (const file of picked) {
        const uploaded = await publishItemImage(publishForm.cookieId, file);
        setPublishForm(current => ({
          ...current,
          images: [...current.images, { ...uploaded, preview: URL.createObjectURL(file) }],
        }));
        setPublishFieldErrors(current => ({ ...current, images: undefined }));
      }
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : '图片上传失败' });
    } finally {
      setPublishUploading(false);
      event.target.value = '';
    }
  };

  const handlePublishSubmit = async () => {
    const errors: Record<string, string> = {};
    if (!publishForm.cookieId) errors.cookieId = '请选择要发布的账号';
    const title = publishForm.title.trim();
    if (!title) errors.title = '请填写宝贝描述';
    if (publishForm.images.length === 0) errors.images = '请至少上传一张商品图片';
    const price = parseFloat(publishForm.price);
    if (!Number.isFinite(price) || price <= 0) errors.price = '请填写大于 0 的价格';
    const originalPrice = parseFloat(publishForm.originalPrice);
    if (publishForm.originalPrice.trim() && (!Number.isFinite(originalPrice) || originalPrice <= 0)) {
      errors.originalPrice = '原价需为大于 0 的数字，或留空';
    }
    setPublishFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    const platformImages = publishForm.images.map(({ url, widthSize, heightSize }) => ({ url, widthSize, heightSize }));

    setPublishing(true);
    try {
      if (!publishConfirm) {
        // 第一步：识别分类，进入确认视图
        const res = await recommendPublishCategory({
          cookie_id: publishForm.cookieId,
          title,
          description: title,
          price,
          images: platformImages,
        });
        setPublishConfirm({ category: res.data.category, candidates: res.data.candidates });
      } else {
        // 第二步：确认后真正上架（分类用用户选中的那个）
        const res = await publishItemToXianyu({
          cookie_id: publishForm.cookieId,
          title,
          description: title,
          price,
          quantity: 1,
          original_price: publishForm.originalPrice.trim() ? originalPrice : null,
          shipping_mode: publishForm.shippingMode,
          address: publishForm.address,
          category: publishConfirm.category,
          images: platformImages,
        });
        setShowPublishModal(false);
        setNotice({ type: 'success', message: `商品已发布：${res.item_url}` });
        setItems(await getItems());
      }
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : '发布失败' });
    } finally {
      setPublishing(false);
    }
  };

  // ---- 平台下架 / 平台删除 / 一键发布 ----

  const onSaleDraftTitle = (item: Item) =>
    item.listing_status === 'on_sale' ? '从闲鱼平台删除商品' : '删除本地记录';

  const handlePublishLocal = async (item: Item) => {
    const confirmed = await confirmAction(
      `确认把本地商品「${item.item_title || item.item_id}」发布到闲鱼？`
      + '图片会自动转存到闲鱼图片空间，分类自动识别；发布后本地记录与发货配置会迁移为平台新商品 ID。',
      { title: '一键发布', confirmLabel: '发布' },
    );
    if (!confirmed) return;
    const key = itemKey(item);
    setSavingKey(key);
    try {
      const res = await publishLocalItem(item.cookie_id, item.item_id);
      setNotice({ type: 'success', message: `${res.message}：${res.item_url}` });
      setItems(await getItems());
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : '发布失败' });
    } finally {
      setSavingKey('');
    }
  };

  const handleRepublish = async (item: Item) => {
    const confirmed = await confirmAction(
      `确认重新上架「${item.item_title || item.item_id}」？`
      + '将按原内容重新发布（闲鱼网页端无原生上架接口，发布后商品 ID 会更新），发货配置自动迁移。',
      { title: '重新上架', confirmLabel: '上架' },
    );
    if (!confirmed) return;
    const key = itemKey(item);
    setSavingKey(key);
    try {
      const res = await republishItem(item.cookie_id, item.item_id);
      setNotice({ type: 'success', message: `${res.message}：${res.item_url}` });
      setItems(await getItems());
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : '重新上架失败' });
    } finally {
      setSavingKey('');
    }
  };

  const handleDownshelf = async (item: Item) => {
    if (!await confirmAction(
      `确认把「${item.item_title || item.item_id}」从闲鱼下架？买家将无法继续浏览购买，本地记录保留。`,
      { title: '下架商品', confirmLabel: '下架' },
    )) return;
    const key = itemKey(item);
    setSavingKey(key);
    try {
      await downshelfItem(item.cookie_id, item.item_id);
      setItems(current => current.map(currentItem =>
        itemKey(currentItem) === key ? { ...currentItem, listing_status: 'off_shelf' } : currentItem,
      ));
      setNotice({ type: 'success', message: '商品已从闲鱼下架' });
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : '下架失败' });
    } finally {
      setSavingKey('');
    }
  };

  // 图片上传：编辑与手动添加共用，上传成功后回填 URL
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, onDone: (url: string) => void) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setNotice({ type: 'error', message: '请选择图片文件' });
      return;
    }
    setImageUploading(true);
    try {
      const res = await uploadImage(file);
      onDone(res.image_url || '');
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : '图片上传失败' });
    } finally {
      setImageUploading(false);
      event.target.value = '';
    }
  };

  const handleSaveDetail = async () => {
    if (!detailItem) return;
    if (!editForm.title.trim()) {
      setNotice({ type: 'error', message: '商品标题不能为空' });
      return;
    }
    const key = itemKey(detailItem);
    setSavingKey(key);
    try {
      const title = editForm.title.trim();
      const price = editForm.price.trim();
      const description = editForm.description.trim();
      const imageUrl = editForm.imageUrl.trim();
      await updateItemInfo(detailItem.cookie_id, detailItem.item_id, {
        title,
        price,
        description,
        image_url: imageUrl,
        item_detail: editForm.detail,
      });
      setItems(current => current.map(item =>
        itemKey(item) === key ? {
          ...item,
          item_title: title,
          item_price: price,
          item_description: description,
          item_image: imageUrl,
          item_detail: editForm.detail,
        } : item,
      ));
      setDetailItem(null);
      setNotice({ type: 'success', message: '商品信息已保存' });
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : '保存失败' });
    } finally {
      setSavingKey('');
    }
  };

  const openDelivery = async (item: Item) => {
    setNotice(null);
    const legacyRule = ruleMap.get(itemKey(item));
    setDeliveryItem(item);
    setDeliveryLoading(true);
    try {
      const config = await getItemDeliveryConfig(item.cookie_id, item.item_id);
      if (config.configured && config.variants.length > 0) {
        setDeliveryForm({
          enabled: config.enabled,
          isMultiSpec: config.is_multi_spec,
          variants: config.variants.map((variant, index) => ({
            clientId: String(variant.id || createEmptyVariant(index).clientId),
            displayName: variant.display_name || '',
            specText: variant.spec_text || '',
            platformSkuId: variant.platform_sku_id || '',
            cardId: variant.card_id ? String(variant.card_id) : '',
            deliveryCount: Math.max(1, variant.delivery_count || 1),
            enabled: variant.enabled && variant.binding_enabled,
          })),
        });
      } else {
        setDeliveryForm({
          enabled: legacyRule?.enabled ?? true,
          isMultiSpec: false,
          variants: [{
            ...createEmptyVariant(),
            displayName: '默认规格',
            cardId: legacyRule?.card_group_id ? String(legacyRule.card_group_id) : '',
            deliveryCount: Math.max(1, legacyRule?.priority || 1),
          }],
        });
      }
    } catch (error) {
      setDeliveryItem(null);
      setNotice({
        type: 'error',
        message: error instanceof Error ? error.message : '发货配置加载失败',
      });
    } finally {
      setDeliveryLoading(false);
    }
  };

  const updateDeliveryVariant = (
    clientId: string,
    patch: Partial<DeliveryVariantForm>,
  ) => {
    setDeliveryForm(current => ({
      ...current,
      variants: current.variants.map(variant =>
        variant.clientId === clientId ? { ...variant, ...patch } : variant,
      ),
    }));
  };

  const addDeliveryVariant = () => {
    setDeliveryForm(current => ({
      ...current,
      variants: [...current.variants, createEmptyVariant(current.variants.length)],
    }));
  };

  const removeDeliveryVariant = (clientId: string) => {
    setDeliveryForm(current => {
      if (current.variants.length <= 1) return current;
      return {
        ...current,
        variants: current.variants.filter(variant => variant.clientId !== clientId),
      };
    });
  };

  const handleSaveDelivery = async () => {
    if (!deliveryItem) return;
    const variantsToSave = deliveryForm.isMultiSpec
      ? deliveryForm.variants
      : deliveryForm.variants.slice(0, 1);
    if (variantsToSave.length === 0) {
      setNotice({ type: 'error', message: '至少需要保留一个商品规格' });
      return;
    }
    const invalidIndex = variantsToSave.findIndex(variant =>
      !variant.cardId || (
        deliveryForm.isMultiSpec
        && (!variant.displayName.trim() || !variant.specText.trim())
      ),
    );
    if (invalidIndex >= 0) {
      setNotice({
        type: 'error',
        message: deliveryForm.isMultiSpec
          ? `请完整填写第 ${invalidIndex + 1} 个规格名称、规格组合和发货库存`
          : '请选择自动发货使用的卡密或内容',
      });
      return;
    }

    const key = itemKey(deliveryItem);
    const legacyRule = ruleMap.get(key);
    setSavingKey(key);
    try {
      await saveItemDeliveryConfig(deliveryItem.cookie_id, deliveryItem.item_id, {
        enabled: deliveryForm.enabled,
        is_multi_spec: deliveryForm.isMultiSpec,
        variants: variantsToSave.map(variant => ({
          display_name: deliveryForm.isMultiSpec
            ? variant.displayName.trim()
            : '默认规格',
          spec_text: deliveryForm.isMultiSpec ? variant.specText.trim() : '',
          spec_payload: undefined,
          platform_sku_id: deliveryForm.isMultiSpec ? variant.platformSkuId.trim() : '',
          card_id: Number(variant.cardId),
          delivery_count: Math.max(1, Math.floor(variant.deliveryCount || 1)),
          enabled: variant.enabled,
          binding_enabled: variant.enabled,
          source: 'manual',
        })),
      });
      if (legacyRule) {
        await deleteShippingRule(legacyRule.id);
        setShippingRules(current => current.filter(rule => rule.id !== legacyRule.id));
      }
      setItems(current => current.map(item =>
        itemKey(item) === key
          ? { ...item, is_multi_spec: deliveryForm.isMultiSpec }
          : item,
      ));
      await reloadDeliveryConfigs();
      setDeliveryItem(null);
      setNotice({ type: 'success', message: '商品自动发货配置已保存' });
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : '发货配置保存失败' });
    } finally {
      setSavingKey('');
    }
  };

  const handleToggleDelivery = async (item: Item) => {
    const key = itemKey(item);
    const configSummary = deliveryConfigMap.get(key);
    const legacyRule = ruleMap.get(key);
    if (!configSummary && !legacyRule) {
      void openDelivery(item);
      return;
    }

    setSavingKey(key);
    try {
      if (configSummary) {
        const config = await getItemDeliveryConfig(item.cookie_id, item.item_id);
        await saveItemDeliveryConfig(item.cookie_id, item.item_id, {
          enabled: !config.enabled,
          is_multi_spec: config.is_multi_spec,
          variants: config.variants.map(variant => ({
            display_name: variant.display_name,
            spec_text: variant.spec_text,
            spec_payload: variant.spec_payload,
            platform_sku_id: variant.platform_sku_id,
            card_id: variant.card_id,
            delivery_count: variant.delivery_count,
            enabled: variant.enabled,
            binding_enabled: variant.binding_enabled,
            source: variant.source || 'manual',
          })),
        });
        await reloadDeliveryConfigs();
      } else if (legacyRule) {
        await updateShippingRule({ ...legacyRule, enabled: !legacyRule.enabled });
        setShippingRules(current => current.map(currentRule =>
          currentRule.id === legacyRule.id
            ? { ...currentRule, enabled: !legacyRule.enabled }
            : currentRule,
        ));
      }
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : '状态更新失败' });
    } finally {
      setSavingKey('');
    }
  };

  const handleDelete = async (item: Item) => {
    const onSale = item.listing_status === 'on_sale';
    const confirmed = await confirmAction(
      onSale
        ? `确认删除「${item.item_title || item.item_id}」？将同步从闲鱼平台删除商品，并移除本地发货配置，不可恢复。`
        : `确认删除商品“${item.item_title || item.item_id}”的本地记录吗？（商品已不在闲鱼在售）`,
      { title: onSale ? '删除商品' : '删除本地记录', confirmLabel: '删除', danger: true },
    );
    if (!confirmed) return;
    const key = itemKey(item);
    const rule = ruleMap.get(key);
    setSavingKey(key);
    try {
      if (onSale) {
        // 在售商品：先从平台删除（顺带清掉本地记录），失败则中止避免半删状态
        try {
          await platformDeleteItem(item.cookie_id, item.item_id);
        } catch (error) {
          setNotice({ type: 'error', message: `平台删除失败：${error instanceof Error ? error.message : '未知错误'}` });
          return;
        }
      }
      if (rule) await deleteShippingRule(rule.id);
      if (!onSale) await deleteItem(item.cookie_id, item.item_id);
      setItems(current => current.filter(currentItem => itemKey(currentItem) !== key));
      setShippingRules(current => current.filter(currentRule => currentRule.id !== rule?.id));
      setDeliveryConfigs(current => current.filter(config =>
        `${config.cookie_id}:${config.item_id}` !== key,
      ));
      setNotice({ type: 'success', message: onSale ? '商品已从闲鱼平台删除' : '商品及其专属发货配置已删除' });
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : '删除失败' });
    } finally {
      setSavingKey('');
    }
  };

  const toggleSetting = async (
    item: Item,
    field: 'multi_quantity_delivery',
  ) => {
    const key = itemKey(item);
    const enabled = !Boolean(item[field]);
    setSavingKey(key);
    try {
      await updateItemMultiQuantity(item.cookie_id, item.item_id, enabled);
      setItems(current => current.map(currentItem =>
        itemKey(currentItem) === key ? { ...currentItem, [field]: enabled } : currentItem,
      ));
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : '状态更新失败' });
    } finally {
      setSavingKey('');
    }
  };

  if (loading) {
    return <PageLoading label="正在加载商品与发货配置" />;
  }

  return (
    <div ref={rootRef} className="page-stack animate-fade-in">
      <PageHeader
        title="商品与发货"
        description="同步在售商品并为每件商品配置专属自动发货，也可切换到通用发货规则与发货保护，统一托管全部商品的卡密交付。"
        icon={Box}
        badge={<span className="status-badge status-badge-info">{items.length} 件商品</span>}
        actions={(
          <>
            <button
              type="button"
              onClick={openPublishModal}
              className="ios-btn-primary flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm"
              title="把商品直接发布上架到闲鱼"
            >
              <Send className="h-4 w-4" />
              发布商品
            </button>
            <button
              type="button"
              onClick={openManualModal}
              className="ios-btn-secondary flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm"
            >
              <Plus className="h-4 w-4" />
              手动添加
            </button>
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing || !selectedAccount}
              className="ios-btn-secondary flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm"
              title={selectedAccount ? '从闲鱼拉取该账号的在售商品' : '请先在左侧选择账号'}
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? '正在同步' : '同步商品'}
            </button>
            <button
              type="button"
              onClick={handlePolish}
              disabled={polishing || items.length === 0}
              className="ios-btn-secondary flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm"
              title="重新获取搜索曝光，平台对每日擦亮次数有限制"
            >
              <Sparkles className={`h-4 w-4 ${polishing ? 'animate-pulse' : ''}`} />
              {polishing ? '正在擦亮' : '一键擦亮'}
            </button>
          </>
        )}
      />

      <PageTabs
        value={activeSection}
        onChange={setActiveSection}
        items={[
          { id: 'products', label: '商品与专属发货', icon: ShoppingBag, count: items.length },
          { id: 'rules', label: '通用发货规则', icon: ListChecks, count: genericRules.length },
          { id: 'protection', label: '发货保护与黑名单', icon: ShieldAlert },
        ]}
        ariaLabel="商品与发货功能"
      />

      {notice && !showPublishModal && !showManualModal && !detailItem && !deliveryItem && (
        <NoticeBanner
          type={notice.type}
          message={notice.message}
          onClose={() => setNotice(null)}
        />
      )}

      <section hidden={activeSection !== 'products'} className="space-y-4">
        {/* 同步操作与商品列表合并为一块：原来「商品同步」独占一张卡片，
            加上页头、Tab、列表标题，看到商品前要先翻过四层，信息密度太低。
            同步账号与列表筛选账号本就是同一个维度，一并收进工具栏。 */}
        <section className="section-panel">
          <div className="toolbar rounded-none border-0 border-b px-4 py-3 shadow-none">
            <div className="toolbar__group">
              <select
                className="ios-input rounded-md px-3 py-2 text-sm"
                value={selectedAccount}
                onChange={event => {
                  setSelectedAccount(event.target.value);
                  setListAccountFilter(event.target.value);
                  setPage(1);
                  if (event.target.value) onSyncedAccountChange?.(event.target.value);
                }}
                aria-label="选择账号"
              >
                <option value="">全部账号（{items.length}）</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {accountNames.get(account.id)}（{items.filter(i => i.cookie_id === account.id).length}）
                  </option>
                ))}
              </select>
              <span className="text-xs text-gray-500">
                已配置专属发货 {configuredItemCount} 件
              </span>
              {offShelfCount > 0 && (
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-500">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 cursor-pointer accent-brand-500"
                    checked={showOffShelf}
                    onChange={event => {
                      setShowOffShelf(event.target.checked);
                      setPage(1);
                    }}
                  />
                  显示已下架（{offShelfCount}）
                </label>
              )}
            </div>
          </div>

          {visibleItems.length > 0 ? (
            <>
              {/* 列宽按比例分配（minmax 保底）：固定 px 在通栏布局下右边会留大片空区，
                  比例列随容器伸缩铺满；保底宽度合计约 1012px，低于此由外层横向滚动兜底，
                  不再强制 1200px 最小宽（1280 视口会白出一条滚动条）。
                  表头与行共用同一套列宽定义。 */}
              <div className="overflow-x-auto">
                <div className="min-w-full">
                  <div className="hidden grid-cols-[minmax(320px,2.7fr)_minmax(120px,1fr)_minmax(260px,2.1fr)_minmax(200px,1.5fr)_minmax(112px,auto)] border-b-2 border-gray-300 bg-gray-100 text-xs font-bold text-gray-600 xl:grid [&>span]:border-r [&>span]:border-gray-300 [&>span]:px-4 [&>span]:py-3 [&>span:nth-child(2)]:px-2 [&>span:last-child]:border-r-0">
                    <span>商品信息</span>
                    <span>所属账号</span>
                    <span>专属自动发货</span>
                    <span>商品能力</span>
                    <span className="text-right">操作</span>
                  </div>
              <div className="divide-y-2 divide-gray-200">
                {pagedItems.map(item => {
                  const key = itemKey(item);
                  const busy = savingKey === key;
                  const rule = ruleMap.get(key);
                  const configSummary = deliveryConfigMap.get(key);
                  const deliveryConfigured = Boolean(configSummary || rule);
                  const deliveryEnabled = configSummary?.enabled ?? Boolean(rule?.enabled);
                  const deliveryIncomplete = Boolean(configSummary && !configSummary.complete);
                  const statusClass = deliveryEnabled
                    ? (deliveryIncomplete ? 'status-badge-warning' : 'status-badge-success')
                    : (deliveryConfigured ? 'status-badge-warning' : 'status-badge-info');
                  const statusText = deliveryEnabled
                    ? (deliveryIncomplete ? '待完善' : '发货中')
                    : (deliveryConfigured ? '已暂停' : '未配置');
                  const deliveryTitle = configSummary
                    ? (
                      configSummary.is_multi_spec
                        ? `${configSummary.configured_count}/${configSummary.variant_count} 个规格已绑定`
                        : '普通商品发货'
                    )
                    : (
                      rule?.card_group_name
                      || (rule ? `卡密 ${rule.card_group_id}` : '尚未绑定发货内容')
                    );
                  const deliveryDescription = configSummary
                    ? (
                      configSummary.complete
                        ? `累计发货 ${configSummary.delivery_times} 次`
                        : '存在未启用或不可用的规格库存'
                    )
                    : (rule ? `每单发货 ${rule.priority} 份` : '配置后可按订单自动发货');
                  return (
                    <article
                      key={key}
                      className="grid gap-4 px-4 py-4 transition-colors hover:bg-brand-50 xl:grid-cols-[minmax(320px,2.7fr)_minmax(120px,1fr)_minmax(260px,2.1fr)_minmax(200px,1.5fr)_minmax(112px,auto)] xl:items-stretch xl:gap-0 xl:px-0 xl:[&>*]:flex xl:[&>*]:min-w-0 xl:[&>*]:flex-col xl:[&>*]:justify-center xl:[&>*]:border-r xl:[&>*]:border-gray-200 xl:[&>*]:px-4 xl:[&>*:first-child]:!flex-row xl:[&>*:first-child]:items-center xl:[&>*:last-child]:border-r-0"
                    >
                      <div className="flex min-w-0 gap-3">
                        <div className="h-20 w-20 flex-none overflow-hidden rounded-md border border-gray-200 bg-gray-100">
                          <ItemImage item={item} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 flex-wrap items-start gap-2">
                            <h3 className={`min-w-0 flex-1 text-sm font-bold leading-5 ${
                              isOffShelf(item) && !isLocalDraft(item) ? 'text-gray-400 line-through' : 'text-gray-900'
                            }`}>
                              {item.item_title || '未命名商品'}
                            </h3>
                            {isOffShelf(item) && !isLocalDraft(item) && (
                              <span
                                className="status-badge shrink-0 bg-gray-100 text-gray-500"
                                title={
                                  item.last_seen_at
                                    ? `最后一次被闲鱼返回：${item.last_seen_at}`
                                    : '闲鱼商品列表已不再返回这件商品'
                                }
                              >
                                已下架
                              </span>
                            )}
                            {isLocalDraft(item) && (
                              <span
                                className="status-badge shrink-0 bg-purple-50 text-purple-600"
                                title="本地商品：尚未发布到闲鱼，可用操作列的火箭按钮一键上架"
                              >
                                未上架
                              </span>
                            )}
                            <span className={`status-badge shrink-0 ${statusClass}`}>
                              {statusText}
                            </span>
                          </div>
                          <p className="mt-1 text-lg font-bold text-[#d92d20]">{formatPrice(item.item_price)}</p>
                          <p className="mt-1 truncate font-mono text-xs text-gray-400">商品 ID {item.item_id}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 border-t border-gray-100 pt-3 xl:!flex-row xl:items-center xl:gap-1.5 xl:border-0 xl:px-2 xl:pt-0">
                        {accountAvatars.get(item.cookie_id) ? (
                          <img
                            src={accountAvatars.get(item.cookie_id)}
                            alt=""
                            className="h-7 w-7 flex-none rounded-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-gray-200 text-[10px] text-gray-500">
                            {(accountNames.get(item.cookie_id) || '?').slice(0, 1)}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-gray-800">
                            {accountNames.get(item.cookie_id) || '未命名账号'}
                          </p>
                          <p className="truncate font-mono text-[10px] text-gray-400">{item.cookie_id}</p>
                        </div>
                      </div>

                      <div className="border-t border-gray-100 pt-3 xl:border-0 xl:pt-0">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <PackageCheck className={`h-4 w-4 shrink-0 ${deliveryEnabled ? 'text-green-600' : 'text-gray-400'}`} />
                              <span className="text-sm font-bold text-gray-800">
                                {deliveryTitle}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-xs text-gray-500">
                              {deliveryDescription}
                            </p>
                          </div>
                          {/* 开关配文字标签：这一列和隔壁「商品能力」列各有一个开关，
                              两者都靠右对齐时纵向几乎连成一条线，用户会误以为是一组。 */}
                          <div className="flex flex-none flex-col items-center gap-1">
                            <Toggle
                              checked={deliveryEnabled}
                              disabled={busy}
                              label={`${item.item_title || item.item_id} 自动发货`}
                              onChange={() => handleToggleDelivery(item)}
                            />
                            <span className="text-[10px] font-semibold text-gray-500">总开关</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openDelivery(item)}
                          disabled={busy}
                          className="ios-btn-secondary mt-3 flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs"
                        >
                          <Settings2 className="h-4 w-4" />
                          {deliveryConfigured ? '编辑发货策略' : '配置自动发货'}
                        </button>
                      </div>

                      {/* 商品能力列：三项里只有「多数量」可点，另两项是只读状态。
                          行与行之间加横线，与列竖线一起构成完整格线。 */}
                      <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 sm:grid-cols-3 xl:grid-cols-1 xl:gap-0 xl:border-0 xl:pt-0 xl:[&>div]:border-b xl:[&>div]:border-dashed xl:[&>div]:border-gray-200 xl:[&>div]:py-1.5 xl:[&>div:last-child]:border-b-0">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-gray-600">规格模式</span>
                          <span className="text-xs font-bold text-gray-800">
                            {configSummary
                              ? (
                                configSummary.is_multi_spec
                                  ? `${configSummary.variant_count} 个规格`
                                  : '普通商品'
                              )
                              : (item.is_multi_spec ? '旧版多规格' : '普通商品')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-gray-600" title="买家一次买 N 件时是否发 N 份">
                            多数量
                          </span>
                          <Toggle
                            checked={Boolean(item.multi_quantity_delivery)}
                            disabled={busy}
                            label={`${item.item_title || item.item_id} 多数量发货`}
                            onChange={() => toggleSetting(item, 'multi_quantity_delivery')}
                          />
                        </div>
                        {/* 详情状态属于「商品能力」而非「操作」，放在本列末尾，
                            避免和操作按钮挤在同一格造成表头与内容错位 */}
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-gray-600">本地详情</span>
                          <span className={`text-xs font-bold ${item.item_detail ? 'text-gray-800' : 'text-gray-400'}`}>
                            {item.item_detail ? '已维护' : '暂无'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1 border-t border-gray-100 pt-3 xl:!flex-row xl:items-center xl:justify-end xl:border-0 xl:pt-0">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openDetail(item)}
                            disabled={busy}
                            className="rounded-md p-2 text-gray-600 hover:bg-gray-100"
                            title="编辑商品信息"
                            aria-label="编辑商品信息"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          {isLocalDraft(item) && (
                            <button
                              type="button"
                              onClick={() => void handlePublishLocal(item)}
                              disabled={busy}
                              className="rounded-md p-2 text-[var(--brand-text)] hover:bg-[var(--brand-soft)]"
                              title="一键发布到闲鱼（分类自动识别）"
                              aria-label="一键发布到闲鱼"
                            >
                              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                            </button>
                          )}
                          {item.listing_status === 'on_sale' && (
                            <button
                              type="button"
                              onClick={() => void handleDownshelf(item)}
                              disabled={busy}
                              className="rounded-md p-2 text-amber-600 hover:bg-amber-50"
                              title="从闲鱼下架（本地记录保留）"
                              aria-label="从闲鱼下架"
                            >
                              <CirclePause className="h-4 w-4" />
                            </button>
                          )}
                          {isOffShelf(item) && !isLocalDraft(item) && (
                            <button
                              type="button"
                              onClick={() => void handleRepublish(item)}
                              disabled={busy}
                              className="rounded-md p-2 text-[var(--brand-text)] hover:bg-[var(--brand-soft)]"
                              title="重新上架（原内容重新发布，配置自动迁移）"
                              aria-label="重新上架"
                            >
                              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            disabled={busy}
                            className="rounded-md p-2 text-red-500 hover:bg-red-50"
                            title={onSaleDraftTitle(item)}
                            aria-label={onSaleDraftTitle(item)}
                          >
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-500">
                    第 {page} 页 / 共 {totalPages} 页（{visibleItems.length} 件）
                  </span>
                  <label className="flex items-center gap-1.5 text-sm text-gray-500">
                    每页
                    <select
                      value={pageSize}
                      onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                      className="ios-input rounded-md px-2 py-1 text-sm"
                      aria-label="每页显示数量"
                    >
                      {[10, 20, 50, 100].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    件
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    上一页
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    下一页
                  </button>
                </div>
              </div>
            </>
          ) : (
            <EmptyState
              title="暂无商品数据"
              description="先选择闲鱼账号同步在售商品，也可以手动添加商品并直接配置自动发货。"
              icon={ShoppingBag}
              action={(
                <button type="button" onClick={openManualModal} className="ios-btn-secondary rounded-md px-4 py-2 text-sm">
                  手动添加商品
                </button>
              )}
            />
          )}
        </section>
      </section>

      <section hidden={activeSection !== 'rules'}>
        <GeneralDeliveryRules
          accounts={accounts}
          cards={cards}
          rules={genericRules}
          onReload={reloadRules}
        />
      </section>

      <section hidden={activeSection !== 'protection'}>
        <DeliveryProtection
          accounts={accounts}
          items={items}
          selectedAccount={selectedAccount}
          onSelectedAccountChange={setSelectedAccount}
        />
      </section>

      {deliveryItem && createPortal(
        <div className="modal-overlay">
          <div className="modal-container modal-container-lg">
            <div className="modal-header flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">商品自动发货</h3>
                <p className="mt-1 line-clamp-1 text-sm text-gray-500">
                  {deliveryItem.item_title || deliveryItem.item_id}
                </p>
              </div>
              <button type="button" onClick={() => setDeliveryItem(null)} className="rounded-md p-2 hover:bg-gray-100" aria-label="关闭">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="modal-body space-y-5">
              <ModalNotice notice={notice} onClose={() => setNotice(null)} />
              {deliveryLoading ? (
                <PageLoading label="正在加载商品发货配置" />
              ) : (
                <>
                  <div className="grid gap-3 rounded-md border border-gray-200 bg-gray-50 p-4 sm:grid-cols-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-500">所属账号</p>
                      <p className="mt-1 truncate text-sm font-bold text-gray-900">
                        {accountNames.get(deliveryItem.cookie_id) || deliveryItem.cookie_id}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-500">商品 ID</p>
                      <p className="mt-1 truncate font-mono text-sm text-gray-900">{deliveryItem.item_id}</p>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <div className="sm:text-right">
                        <p className="text-sm font-bold text-gray-900">自动发货</p>
                        <p className="mt-1 text-xs text-gray-500">关闭后保留全部绑定</p>
                      </div>
                      <Toggle
                        checked={deliveryForm.enabled}
                        label="启用商品自动发货"
                        onChange={() => setDeliveryForm(current => ({ ...current, enabled: !current.enabled }))}
                      />
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-bold text-gray-800">商品规格模式</p>
                    <div className="grid grid-cols-2 rounded-md border border-gray-200 bg-gray-100 p-1" role="radiogroup" aria-label="商品规格模式">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={!deliveryForm.isMultiSpec}
                        onClick={() => setDeliveryForm(current => ({ ...current, isMultiSpec: false }))}
                        className={`rounded px-3 py-2 text-sm font-semibold ${
                          !deliveryForm.isMultiSpec
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-800'
                        }`}
                      >
                        普通商品
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={deliveryForm.isMultiSpec}
                        onClick={() => setDeliveryForm(current => ({ ...current, isMultiSpec: true }))}
                        className={`rounded px-3 py-2 text-sm font-semibold ${
                          deliveryForm.isMultiSpec
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-800'
                        }`}
                      >
                        多规格商品
                      </button>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-gray-500">
                      {deliveryForm.isMultiSpec
                        ? '订单规格必须与下方某一规格组合精确匹配，否则系统会阻止发货，不会使用其他规格库存兜底。'
                        : '所有订单使用同一个发货库存；如商品有套餐、周期或版本差异，请切换为多规格商品。'}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {(deliveryForm.isMultiSpec
                      ? deliveryForm.variants
                      : deliveryForm.variants.slice(0, 1)
                    ).map((variant, index) => {
                      const selectedCard = cards.find(card => String(card.id) === variant.cardId);
                      return (
                        <article key={variant.clientId} className="rounded-md border border-gray-200 bg-white">
                          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
                            <div className="min-w-0">
                              <h4 className="truncate text-sm font-bold text-gray-900">
                                {deliveryForm.isMultiSpec
                                  ? (variant.displayName.trim() || `规格 ${index + 1}`)
                                  : '默认发货配置'}
                              </h4>
                              <p className="mt-0.5 truncate text-xs text-gray-500">
                                {deliveryForm.isMultiSpec
                                  ? (variant.specText.trim() || '等待填写规格组合')
                                  : '适用于该商品的全部订单'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Toggle
                                checked={variant.enabled}
                                label={`${variant.displayName || `规格 ${index + 1}`} 启用状态`}
                                onChange={() => updateDeliveryVariant(variant.clientId, { enabled: !variant.enabled })}
                              />
                              {deliveryForm.isMultiSpec && deliveryForm.variants.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeDeliveryVariant(variant.clientId)}
                                  className="rounded-md p-2 text-red-500 hover:bg-red-50"
                                  title="删除规格"
                                  aria-label={`删除规格 ${index + 1}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="grid gap-4 p-4 sm:grid-cols-2">
                            {deliveryForm.isMultiSpec && (
                              <>
                                <div>
                                  <label className="field-label" htmlFor={`variant-name-${variant.clientId}`}>规格显示名称</label>
                                  <input
                                    id={`variant-name-${variant.clientId}`}
                                    value={variant.displayName}
                                    onChange={event => updateDeliveryVariant(variant.clientId, { displayName: event.target.value })}
                                    className="ios-input w-full rounded-md px-3 py-2.5"
                                    placeholder="例如：周卡 / 独享"
                                  />
                                </div>
                                <div>
                                  <label className="field-label" htmlFor={`variant-spec-${variant.clientId}`}>规格组合</label>
                                  <input
                                    id={`variant-spec-${variant.clientId}`}
                                    value={variant.specText}
                                    onChange={event => updateDeliveryVariant(variant.clientId, { specText: event.target.value })}
                                    className="ios-input w-full rounded-md px-3 py-2.5"
                                    placeholder="周期=周卡 | 版本=独享"
                                  />
                                </div>
                                <div className="sm:col-span-2">
                                  <label className="field-label" htmlFor={`variant-sku-${variant.clientId}`}>
                                    闲鱼 SKU ID <span className="font-normal text-gray-400">（可选，填写后优先匹配）</span>
                                  </label>
                                  <input
                                    id={`variant-sku-${variant.clientId}`}
                                    value={variant.platformSkuId}
                                    onChange={event => updateDeliveryVariant(variant.clientId, { platformSkuId: event.target.value })}
                                    className="ios-input w-full rounded-md px-3 py-2.5 font-mono"
                                    placeholder="从订单或商品接口获取的平台规格 ID"
                                  />
                                </div>
                              </>
                            )}

                            <div>
                              <label className="field-label" htmlFor={`variant-card-${variant.clientId}`}>绑定发货库存</label>
                              <select
                                id={`variant-card-${variant.clientId}`}
                                value={variant.cardId}
                                onChange={event => updateDeliveryVariant(variant.clientId, { cardId: event.target.value })}
                                className="ios-input w-full rounded-md px-3 py-2.5"
                              >
                                <option value="">请选择卡密或内容</option>
                                {cards.map(card => (
                                  <option key={card.id} value={card.id} disabled={!card.enabled}>
                                    {card.name || `卡密 ${card.id}`} · {cardTypeLabels[card.type]}
                                    {card.enabled ? '' : '（已停用）'}
                                  </option>
                                ))}
                              </select>
                              <p className={`mt-1.5 text-xs ${selectedCard?.enabled === false ? 'text-red-600' : 'text-gray-500'}`}>
                                {getCardStockLabel(selectedCard)}
                              </p>
                            </div>

                            <div>
                              <label className="field-label" htmlFor={`variant-count-${variant.clientId}`}>每购买 1 件发货份数</label>
                              <input
                                id={`variant-count-${variant.clientId}`}
                                type="number"
                                min={1}
                                step={1}
                                value={variant.deliveryCount}
                                onChange={event => updateDeliveryVariant(variant.clientId, {
                                  deliveryCount: Math.max(1, Math.floor(Number(event.target.value) || 1)),
                                })}
                                className="ios-input w-full rounded-md px-3 py-2.5"
                              />
                              <p className={`mt-1.5 text-xs ${deliveryItem.multi_quantity_delivery ? 'text-gray-500' : 'text-amber-700'}`}>
                                {deliveryItem.multi_quantity_delivery
                                  ? `已开启「多数量」：买 N 件发 ${variant.deliveryCount || 1} × N 份。`
                                  : `⚠️ 未开启「多数量」：无论买家拍几件都只发 ${variant.deliveryCount || 1} 份。需按件数递增请到商品列表开启「多数量」。`}
                              </p>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  {deliveryForm.isMultiSpec && (
                    <button
                      type="button"
                      onClick={addDeliveryVariant}
                      className="ios-btn-secondary flex w-full items-center justify-center gap-2 rounded-md border-dashed px-4 py-2.5 text-sm"
                    >
                      <Plus className="h-4 w-4" />
                      添加商品规格
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer flex justify-end gap-2">
              <button type="button" onClick={() => setDeliveryItem(null)} className="ios-btn-secondary rounded-md px-4 py-2.5">
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveDelivery}
                disabled={Boolean(savingKey) || deliveryLoading}
                className="ios-btn-primary flex items-center gap-2 rounded-md px-4 py-2.5"
              >
                {savingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                保存策略
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {detailItem && createPortal(
        <div className="modal-overlay">
          <div className="modal-container modal-container-lg">
            <div className="modal-header flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">编辑商品</h3>
                <p className="mt-1 line-clamp-1 text-sm text-gray-500">{editForm.title || detailItem.item_id}</p>
              </div>
              <button type="button" onClick={() => setDetailItem(null)} className="rounded-md p-2 hover:bg-gray-100" aria-label="关闭">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="modal-body grid grid-cols-1 gap-4 sm:grid-cols-2">
              {notice && (
                <div className="sm:col-span-2">
                  <ModalNotice notice={notice} onClose={() => setNotice(null)} />
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-bold text-gray-700" htmlFor="item-title">商品标题</label>
                <input
                  id="item-title"
                  value={editForm.title}
                  onChange={event => setEditForm(current => ({ ...current, title: event.target.value }))}
                  className="ios-input w-full rounded-md px-3 py-2.5"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700" htmlFor="item-price">价格（元）</label>
                <input
                  id="item-price"
                  value={editForm.price}
                  onChange={event => setEditForm(current => ({ ...current, price: event.target.value }))}
                  className="ios-input w-full rounded-md px-3 py-2.5"
                  placeholder="例如 80"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700" htmlFor="item-description">商品简介</label>
                <input
                  id="item-description"
                  value={editForm.description}
                  onChange={event => setEditForm(current => ({ ...current, description: event.target.value }))}
                  className="ios-input w-full rounded-md px-3 py-2.5"
                />
              </div>
              <div className="sm:col-span-2">
                <ImageField
                  id="item-image"
                  value={editForm.imageUrl}
                  uploading={imageUploading}
                  onChange={imageUrl => setEditForm(current => ({ ...current, imageUrl }))}
                  onUpload={event => void handleImageUpload(event, imageUrl => setEditForm(current => ({ ...current, imageUrl })))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-bold text-gray-700" htmlFor="item-detail">本地详情</label>
                <textarea
                  id="item-detail"
                  value={editForm.detail}
                  onChange={event => setEditForm(current => ({ ...current, detail: event.target.value }))}
                  className="ios-input !min-h-[240px] w-full resize-y rounded-md p-3 font-mono text-sm"
                  placeholder="补充商品说明，供自动回复和发货逻辑读取。"
                />
              </div>
            </div>
            <div className="modal-footer flex justify-end gap-2">
              <button type="button" onClick={() => setDetailItem(null)} className="ios-btn-secondary rounded-md px-4 py-2.5">取消</button>
              <button
                type="button"
                onClick={handleSaveDetail}
                disabled={Boolean(savingKey) || imageUploading}
                className="ios-btn-primary flex items-center gap-2 rounded-md px-4 py-2.5"
              >
                {savingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                保存
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {showManualModal && createPortal(
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">手动添加商品</h3>
                <p className="mt-1 text-sm text-gray-500">适用于暂未同步到列表、但需要配置自动发货的商品。</p>
              </div>
              <button type="button" onClick={() => setShowManualModal(false)} className="rounded-md p-2 hover:bg-gray-100" aria-label="关闭">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="modal-body grid grid-cols-1 gap-4 sm:grid-cols-2">
              {notice && (
                <div className="sm:col-span-2">
                  <ModalNotice notice={notice} onClose={() => setNotice(null)} />
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-bold text-gray-700" htmlFor="manual-account">所属账号</label>
                <select
                  id="manual-account"
                  value={manualForm.cookieId}
                  onChange={event => setManualForm(current => ({ ...current, cookieId: event.target.value }))}
                  className="ios-input w-full rounded-md px-3 py-2.5"
                >
                  <option value="">请选择账号</option>
                  {accounts.map(account => (
                    <option key={account.id} value={account.id}>{accountNames.get(account.id)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700" htmlFor="manual-item-id">商品 ID</label>
                <input
                  id="manual-item-id"
                  value={manualForm.itemId}
                  onChange={event => setManualForm(current => ({ ...current, itemId: event.target.value }))}
                  className="ios-input w-full rounded-md px-3 py-2.5"
                  placeholder="例如 1070863591807"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700" htmlFor="manual-price">价格</label>
                <input
                  id="manual-price"
                  value={manualForm.price}
                  onChange={event => setManualForm(current => ({ ...current, price: event.target.value }))}
                  className="ios-input w-full rounded-md px-3 py-2.5"
                  placeholder="例如 80"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-bold text-gray-700" htmlFor="manual-title">商品标题</label>
                <input
                  id="manual-title"
                  value={manualForm.title}
                  onChange={event => setManualForm(current => ({ ...current, title: event.target.value }))}
                  className="ios-input w-full rounded-md px-3 py-2.5"
                />
              </div>
              <div className="sm:col-span-2">
                <ImageField
                  id="manual-image"
                  value={manualForm.imageUrl}
                  uploading={imageUploading}
                  onChange={imageUrl => setManualForm(current => ({ ...current, imageUrl }))}
                  onUpload={event => void handleImageUpload(event, imageUrl => setManualForm(current => ({ ...current, imageUrl })))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-bold text-gray-700" htmlFor="manual-description">商品简介</label>
                <input
                  id="manual-description"
                  value={manualForm.description}
                  onChange={event => setManualForm(current => ({ ...current, description: event.target.value }))}
                  className="ios-input w-full rounded-md px-3 py-2.5"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-bold text-gray-700" htmlFor="manual-detail">本地详情</label>
                <textarea
                  id="manual-detail"
                  value={manualForm.detail}
                  onChange={event => setManualForm(current => ({ ...current, detail: event.target.value }))}
                  className="ios-input !min-h-[140px] w-full resize-y rounded-md p-3"
                />
              </div>
            </div>
            <div className="modal-footer flex justify-end gap-2">
              <button type="button" onClick={() => setShowManualModal(false)} className="ios-btn-secondary rounded-md px-4 py-2.5">
                取消
              </button>
              <button
                type="button"
                onClick={handleCreateManualItem}
                disabled={savingKey === 'manual-item'}
                className="ios-btn-primary flex items-center gap-2 rounded-md px-4 py-2.5"
              >
                {savingKey === 'manual-item' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                添加商品
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {showPublishModal && createPortal(
        <div className="modal-overlay">
          <div className="modal-container modal-container-lg">
            <div className="modal-header flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{publishConfirm ? '确认发布' : '发布商品'}</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {publishConfirm
                    ? '核对识别出的分类与商品信息，确认后上架到闲鱼。'
                    : '直接上架到闲鱼平台：填写描述、上传图片，系统自动识别分类后需确认。'}
                </p>
              </div>
              <button type="button" onClick={() => setShowPublishModal(false)} className="rounded-md p-2 hover:bg-gray-100" aria-label="关闭">
                <X className="h-5 w-5" />
              </button>
            </div>

            {!publishConfirm ? (
              <div className="modal-body grid grid-cols-1 gap-4 sm:grid-cols-2">
                {notice && (
                  <div className="sm:col-span-2">
                    <ModalNotice notice={notice} onClose={() => setNotice(null)} />
                  </div>
                )}
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-bold text-gray-700" htmlFor="publish-account">发布到账号</label>
                  <select
                    id="publish-account"
                    value={publishForm.cookieId}
                    onChange={event => {
                      const cookieId = event.target.value;
                      setPublishForm(current => ({ ...current, cookieId, address: null }));
                      setPublishFieldErrors(current => ({ ...current, cookieId: undefined }));
                      void loadPublishAddresses(cookieId).then(options => {
                        if (options.length) {
                          setPublishForm(current => (current.cookieId === cookieId && !current.address
                            ? { ...current, address: options[0] }
                            : current));
                        }
                      });
                    }}
                    className="ios-input w-full rounded-md px-3 py-2.5"
                  >
                    <option value="">请选择账号</option>
                    {accounts.map(account => (
                      <option key={account.id} value={account.id}>{accountNames.get(account.id)}</option>
                    ))}
                  </select>
                  {publishFieldErrors.cookieId && (
                    <p className="mt-1.5 text-xs font-bold text-red-500">{publishFieldErrors.cookieId}</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-bold text-gray-700" htmlFor="publish-title">宝贝描述（同时作为标题）</label>
                  <textarea
                    id="publish-title"
                    value={publishForm.title}
                    onChange={event => {
                      setPublishForm(current => ({ ...current, title: event.target.value.slice(0, 1500) }));
                      setPublishFieldErrors(current => ({ ...current, title: undefined }));
                    }}
                    className="ios-input !min-h-[110px] w-full resize-y rounded-md p-3"
                    placeholder="描述越具体，分类识别越准（例如：九成新山地自行车，自提优先）"
                  />
                  <div className="mt-1 flex items-baseline justify-between gap-2">
                    {publishFieldErrors.title ? (
                      <p className="text-xs font-bold text-red-500">{publishFieldErrors.title}</p>
                    ) : <span />}
                    <p className="text-xs text-gray-400">{publishForm.title.length}/1500</p>
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-gray-700" htmlFor="publish-price">价格（元）</label>
                  <input
                    id="publish-price"
                    value={publishForm.price}
                    onChange={event => {
                      setPublishForm(current => ({ ...current, price: event.target.value }));
                      setPublishFieldErrors(current => ({ ...current, price: undefined }));
                    }}
                    className="ios-input w-full rounded-md px-3 py-2.5"
                    placeholder="例如 420"
                    inputMode="decimal"
                  />
                  {publishFieldErrors.price && (
                    <p className="mt-1.5 text-xs font-bold text-red-500">{publishFieldErrors.price}</p>
                  )}
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-gray-700" htmlFor="publish-original-price">原价（元，选填）</label>
                  <input
                    id="publish-original-price"
                    value={publishForm.originalPrice}
                    onChange={event => {
                      setPublishForm(current => ({ ...current, originalPrice: event.target.value }));
                      setPublishFieldErrors(current => ({ ...current, originalPrice: undefined }));
                    }}
                    className="ios-input w-full rounded-md px-3 py-2.5"
                    placeholder="划线价，例如 599"
                    inputMode="decimal"
                  />
                  {publishFieldErrors.originalPrice && (
                    <p className="mt-1.5 text-xs font-bold text-red-500">{publishFieldErrors.originalPrice}</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-bold text-gray-700">发货设置</label>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { value: 'free', label: '包邮' },
                      { value: 'freight', label: '按距离计费' },
                      { value: 'self', label: '无需邮寄（自提）' },
                    ] as const).map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setPublishForm(current => ({ ...current, shippingMode: option.value }))}
                        className={`rounded-md border px-3.5 py-2 text-sm font-bold transition-colors ${
                          publishForm.shippingMode === option.value
                            ? 'border-[var(--border-brand)] bg-[var(--brand-soft)] text-[var(--brand-text)]'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-bold text-gray-700" htmlFor="publish-address">宝贝所在地</label>
                  <select
                    id="publish-address"
                    value={publishForm.address ? String(publishForm.address.poiId || '') : ''}
                    onChange={event => {
                      const poiId = event.target.value;
                      const next = addressOptions.find(addr => String(addr.poiId || '') === poiId) || null;
                      setPublishForm(current => ({ ...current, address: next }));
                    }}
                    className="ios-input w-full rounded-md px-3 py-2.5"
                    disabled={addressLoading || addressOptions.length === 0}
                  >
                    {addressLoading && <option>正在加载地址…</option>}
                    {!addressLoading && addressOptions.length === 0 && <option>使用账号默认地址</option>}
                    {addressOptions.map(addr => (
                      <option key={String(addr.poiId || '')} value={String(addr.poiId || '')}>
                        {`${addr.prov || ''}${addr.city || ''}${addr.area || ''} · ${addr.poi || addr.aoi || addr.address || ''}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-bold text-gray-700">商品图片（{publishForm.images.length}/9，第一张为主图）</label>
                  <div className="flex flex-wrap gap-2">
                    {publishForm.images.map((image, index) => (
                      <div key={image.url} className="relative h-20 w-20">
                        <img src={image.preview || image.url} alt="" className="h-full w-full rounded-md border border-gray-200 object-cover" />
                        {index === 0 && (
                          <span className="absolute left-0 top-0 rounded-br-md bg-[var(--brand)] px-1.5 py-0.5 text-[10px] font-bold text-brand-ink">主图</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setPublishForm(current => ({
                            ...current,
                            images: current.images.filter(img => img.url !== image.url),
                          }))}
                          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow"
                          aria-label="移除图片"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {publishForm.images.length < 9 && (
                      <label className={`flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-gray-300 text-gray-400 hover:border-[var(--border-brand)] hover:text-[var(--brand-text)] ${
                        publishUploading ? 'pointer-events-none opacity-60' : ''
                      }`}>
                        {publishUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                        <span className="text-[10px] font-bold">{publishUploading ? '上传中' : '添加图片'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={event => void handlePublishImageUpload(event)}
                          disabled={publishUploading}
                        />
                      </label>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-gray-400">图片会直接上传到闲鱼图片空间；注意部分分类（如软件服务类）网页端禁止发布。</p>
                  {publishFieldErrors.images && (
                    <p className="mt-1.5 text-xs font-bold text-red-500">{publishFieldErrors.images}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="modal-body space-y-4">
                <ModalNotice notice={notice} onClose={() => setNotice(null)} />
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">商品分类（点选可切换）</p>
                  <div className="flex flex-wrap gap-2">
                    {publishConfirm.candidates.map(candidate => {
                      const selected = String(publishConfirm.category.catId) === String(candidate.catId);
                      return (
                        <button
                          key={String(candidate.catId)}
                          type="button"
                          onClick={() => setPublishConfirm(current =>
                            current ? { ...current, category: candidate } : current)}
                          className={`rounded-md border px-3.5 py-2 text-sm font-bold transition-colors ${
                            selected
                              ? 'border-[var(--border-brand)] bg-[var(--brand-soft)] text-[var(--brand-text)]'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          {candidate.catName}
                          {selected && <span className="ml-1 text-[10px]">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                  {publishConfirm.candidates.length <= 1 && (
                    <p className="mt-1.5 text-xs text-gray-400">闲鱼仅识别出此分类，无可切换项</p>
                  )}
                </div>
                <div className="flex items-start gap-3">
                  {publishForm.images[0] && (
                    <img src={publishForm.images[0].preview || publishForm.images[0].url} alt="" className="h-16 w-16 flex-none rounded-md border border-gray-200 object-cover" />
                  )}
                  <div className="min-w-0">
                    <p className="line-clamp-3 text-sm text-gray-800">{publishForm.title}</p>
                    <p className="mt-1.5 text-lg font-bold text-[#d92d20]">
                      ¥{publishForm.price}
                      {publishForm.originalPrice.trim() && (
                        <span className="ml-1.5 align-middle text-sm font-medium text-gray-400 line-through">¥{publishForm.originalPrice}</span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {publishForm.images.length} 张图片 · {
                        { free: '包邮', freight: '按距离计费', self: '无需邮寄（自提）' }[publishForm.shippingMode]
                      } · 数量 1
                    </p>
                    {publishForm.address && (
                      <p className="mt-0.5 text-xs text-gray-500">
                        宝贝所在地：{publishForm.address.prov}{publishForm.address.city}{publishForm.address.area} · {publishForm.address.poi || publishForm.address.aoi}
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-xs leading-5 text-gray-500">
                  确认后商品将立即上架到「{accountNames.get(publishForm.cookieId) || publishForm.cookieId}」，
                  买家即可浏览购买；发布成功后会自动出现在商品列表中。
                </p>
              </div>
            )}

            <div className="modal-footer flex justify-end gap-2">
              {publishConfirm ? (
                <button
                  type="button"
                  onClick={() => setPublishConfirm(null)}
                  disabled={publishing}
                  className="ios-btn-secondary rounded-md px-4 py-2.5"
                >
                  返回修改
                </button>
              ) : (
                <button type="button" onClick={() => setShowPublishModal(false)} className="ios-btn-secondary rounded-md px-4 py-2.5">
                  取消
                </button>
              )}
              <button
                type="button"
                onClick={handlePublishSubmit}
                disabled={publishing || publishUploading}
                className="ios-btn-primary flex items-center gap-2 rounded-md px-4 py-2.5"
              >
                {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {publishing ? (publishConfirm ? '正在发布' : '正在识别') : publishConfirm ? '确认发布' : '识别分类并预览'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default ItemList;
