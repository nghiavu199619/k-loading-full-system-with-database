import React, { useState } from 'react';
import { TabConfig } from '../types';

interface TabContainerProps {
  tabs: TabConfig[];
  defaultTab?: string;
  className?: string;
}

export const TabContainer: React.FC<TabContainerProps> = ({
  tabs,
  defaultTab,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const activeTabConfig = tabs.find(tab => tab.id === activeTab);

  return (
    <div className={`handsontable-renderer ${className}`}>
      {/* Tab Navigation */}
      <div className="tab-navigation border-b border-gray-200 mb-4">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.title}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTabConfig && (
          <activeTabConfig.component {...(activeTabConfig.props || {})} />
        )}
      </div>
    </div>
  );
};